var Cryptor = (function () {
    var Cryptor = function () {
    };

    Cryptor.encrypted = "";

    Cryptor.prototype.encrypt = function (plaintext, key) {
        return CryptoJS.AES.encrypt(plaintext, key).toString();
    };

    Cryptor.prototype.decrypt = function (ciphertext, key) {
        return CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8);
    };

    return Cryptor;
})();

var Adapter = (function () {
    var Adapter = function (sttws) {
        this.initialized = false;
        this.listening = false;
        this.sttws = sttws;
    };

    var convertoFloat32ToInt16 = function (buffer) {
        var l = buffer.length;
        var buf = new Int16Array(l)

        while (l--) {
            buf[l] = buffer[l] * 0xFFFF;    //convert to 16 bit
        }
        return buf.buffer
    };

    Adapter.prototype.handleSuccess = function (stream) {
        var that = this;
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        var context = new AudioContext();
        var input = context.createMediaStreamSource(stream)
        var processor = context.createScriptProcessor(1024, 1, 1);

        processor.onaudioprocess = function (e) {
            if (that.listening) {
                var voice = e.inputBuffer.getChannelData(0);
                that.sttws.send(convertoFloat32ToInt16(voice));
            }
        };

        input.connect(processor);
        processor.connect(context.destination);
    };

    Adapter.prototype.toggle = function () {
        var that = this;
        if (this.listening) {
            document.getElementById("toggle").innerHTML = "Start";
            this.listening = false;
            this.sttws.stop();
        } else {
            if (!this.initialized) {
                navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream){
                    that.handleSuccess(stream);
                }).catch(function (reason) {
                    document.getElementById("log").innerHTML += reason + "\n";
                });
                this.initialized = true;
            }
            document.getElementById("toggle").innerHTML = "Stop";
            this.listening = true;
        }
    };

    return Adapter;
})();

var SttWs = (function () {
    var SttWs = function (token) {
        this.wsURI = "wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize"
            + "?watson-token=" + token
            + "&model=ja-JP_BroadbandModel";
        this.websocket = null;
        this.listening = false;
        this.open();
    };

    SttWs.prototype.send = function (blob) {
        if(!this.listening){
            this.open();
        }
        if(this.websocket.readyState === 1){
            this.websocket.send(blob);
        }
    };

    SttWs.prototype.stop = function(){
        this.websocket.send(JSON.stringify({ "action": "stop" }));
        this.listening = false;
        this.websocket.close();
        this.websocket = null;
    };

    SttWs.prototype.open = function(){
        var that = this;
        var message = {
            "action": "start",
            "content-type": "audio/l16;rate=22050"
        };
        if(!this.websocket){
            this.websocket = new WebSocket(this.wsURI);
            this.websocket.onopen = function (evt) {
                that.websocket.send(JSON.stringify(message));
                that.listening = true;
            };
            this.websocket.onclose = function (evt) { 
                console.log(evt.data);
                document.getElementById("log").innerHTML += evt.data + "\n";
                that.websocket = null;
                that.listening = false;
            };
            this.websocket.onmessage = function (evt) { onMessage(evt) };
            this.websocket.onerror = function (evt) { onError(evt) };
        } else {
            this.listening = true;
        }
    };

    function onMessage(evt) {
        console.log(evt.data);
        document.getElementById("log").innerHTML += evt.data + "\n";
    }

    function onError(evt) {
        console.log(evt.data);
        document.getElementById("log").innerHTML += evt.data + "\n";
    }

    return SttWs;
})();

var adapter = null;

document.getElementById("open").addEventListener("click", function () {
    try{
        var key = document.getElementById("token").value;
        //var cryptor = new Cryptor();
        //var token = cryptor.decrypt(Cryptor.encrypted, key);
        var sttws = new SttWs(key);
        adapter = new Adapter(sttws);
    } catch (e) {
        document.getElementById("log").innerHTML += e + "\n";
    }
});

document.getElementById("toggle").addEventListener("click", function () {
    if (adapter) {
        adapter.toggle();
    }
});