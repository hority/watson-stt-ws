var AudioContext = window.AudioContext || window.webkitAudioContext;

var Logger = (function () {
    var Logger = function () {
    };

    Logger.prototype.log = function (msg) {
        console.log(msg);
        document.getElementById("log").innerHTML += msg + "\n";
    };

    return Logger;
})();

var Listener = (function () {

    var Listener = function (speechToText, stateChanged, logger) {
        var that = this;
        this.state = Listener.INITIALIZING;
        this.speechToText = speechToText;
        this.stateChanged = stateChanged;
        this.logger = logger;

        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function (stream) {
            that.detectSilence(stream);
            that.onGetUserMediaComplete(stream);
        }).catch(function (reason) {
            that.onError(reason);
        });
    };

    Listener.INITIALIZING = 0;
    Listener.INITIALIZED = 1;
    Listener.LISTENING = 2;

    Listener.prototype.convertoFloat32ToInt16 = function (buffer) {
        var l = buffer.length;
        var buf = new Int16Array(l / 2);
        while (l--) {
            if (l % 2 == 0) {
                buf[l / 2] = buffer[l] * 0xFFFF;
            }
        }
        return buf.buffer
    };

    Listener.prototype.detectSilence = function (
        stream,
        silence_delay = 5000,
        min_decibels = -60
    ) {
        var that = this;
        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        const streamNode = ctx.createMediaStreamSource(stream);
        streamNode.connect(analyser);
        analyser.minDecibels = min_decibels;

        const data = new Uint8Array(analyser.frequencyBinCount); // will hold our data
        let silence_start = performance.now();
        let triggered = false; // trigger only once per silence event

        function loop(time) {
            requestAnimationFrame(loop); // we'll loop every 60th of a second to check
            analyser.getByteFrequencyData(data); // get current data
            if (data.some(v => v)) { // if there is data above the given db limit
                if (that.state === Listener.INITIALIZED) {
                    that.logger.log("Speaking detected.");
                    that.start();
                }
                silence_start = time; // set it to now
            }
            if (that.state == Listener.LISTENING && time - silence_start > silence_delay) {
                that.logger.log("Silence detected.");
                that.stop();
            }
        }
        loop();
    };

    Listener.prototype.onGetUserMediaComplete = function (stream) {
        var that = this;

        var context = new AudioContext();
        var input = context.createMediaStreamSource(stream)
        var processor = context.createScriptProcessor(1024, 1, 1);

        processor.onaudioprocess = function (e) {
            if (that.state === Listener.LISTENING) {
                var voice = e.inputBuffer.getChannelData(0);
                voice = that.convertoFloat32ToInt16(voice);
                that.speechToText.send(voice);
            }
        };

        input.connect(processor);
        processor.connect(context.destination);
        that.setState(Listener.INITIALIZED);
    };

    Listener.prototype.setState = function (val) {
        if (this.state !== val) {
            this.state = val;
            this.onStateChanged();
        }
    };

    Listener.prototype.start = function () {
        if (this.state === Listener.INITIALIZED) {
            this.setState(Listener.LISTENING);
        } else {
            this.onError("Listener is not initialized.");
        }
    };

    Listener.prototype.stop = function () {
        if (this.state === Listener.LISTENING) {
            this.speechToText.stop();
            this.setState(Listener.INITIALIZED);
        }
    };

    Listener.prototype.toggle = function(){
        if(this.state === Listener.LISTENING){
            this.stop();
        } else if(this.state === Listener.INITIALIZED){
            this.start();
        }
    }

    Listener.prototype.onStateChanged = function () {
        if (this.stateChanged) {
            this.stateChanged(this.state);
        }
    };

    Listener.prototype.onError = function (msg) {
        this.logger.log(msg);
    };

    return Listener;
})();

var SpeechToText = (function () {
    var SpeechToText = function (token, logger) {
        this.wsURI = "wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize"
            + "?watson-token=" + token
            + "&model=ja-JP_BroadbandModel";
        this.websocket = null;
        this.logger = logger;
        this.isopening = false;
    };

    SpeechToText.prototype.open = function (blob) {
        if (!this.isopening) {
            this.close();
            this.isopening = true;
            var that = this;
            this.websocket = new WebSocket(this.wsURI);
            this.websocket.onopen = function () {
                that.start();
                if (blob) {
                    that.send(blob, false);
                }
                that.isopening = false;
                that.logger.log("WebSocket connection is opened.");
            };
            this.websocket.onmessage = function (evt) {
                that.onMessage(evt);
            };
            this.websocket.onerror = function (evt) {
                that.onError("WebSocket connection error.");
            };
            this.websocket.onclose = function (evt) {
                that.onClose("WebSocket connection is closed. [" + evt.reason + "]");
            };
        }
    };

    SpeechToText.prototype.close = function () {
        if (this.websocket && this.websocket.readyState === 1) {
            this.websocket.close();
        }
        this.websocket = null;
        this.isopening = false;
    }

    SpeechToText.prototype.start = function () {
        if (this.websocket && this.websocket.readyState === 1) {
            this.websocket.send(JSON.stringify({
                "action": "start",
                "content-type": "audio/l16;rate=22050"
            }));
        }
    };

    SpeechToText.prototype.send = function (blob, auto = true) {
        var that = this;
        if (this.websocket && this.websocket.readyState === 1) {
            this.websocket.send(blob);
        } else if (auto) {
            this.open(blob);
        }
    };

    SpeechToText.prototype.stop = function () {
        if (this.websocket && this.websocket.readyState === 1) {
            this.websocket.send(JSON.stringify({ "action": "stop" }));
        }
    };

    SpeechToText.prototype.onMessage = function (evt) {
        this.logger.log(evt.data);
    };

    SpeechToText.prototype.onError = function (msg) {
        this.logger.log(msg);
        this.close();
    };

    SpeechToText.prototype.onClose = function (msg) {
        this.logger.log(msg);
        this.close();
    };

    return SpeechToText;
})();

document.getElementById("step2").style.display = "none";

var logger = new Logger();
var listener = null;

document.getElementById("open").addEventListener("click", function () {
    var key = document.getElementById("token").value;
    var stt = new SpeechToText(key, logger);
    listener = new Listener(stt, function (state) {
        if(state === Listener.INITIALIZED){
            document.getElementById("toggle").innerHTML = "START";
            document.getElementById("toggle").classList.add("btn-success");
            document.getElementById("toggle").classList.remove("btn-danger");
        } else if(state === Listener.LISTENING){
            document.getElementById("toggle").innerHTML = "STOP";
            document.getElementById("toggle").classList.remove("btn-success");
            document.getElementById("toggle").classList.add("btn-danger");
        }
    }, logger);

    document.getElementById("step1").style.display = "none";
    document.getElementById("step2").style.display = "block";
});

document.getElementById("toggle").addEventListener("click", function () {
    try {
        listener.toggle();
    } catch (e) {
        logger.log(e);
    }
});