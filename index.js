var Cryptor = (function () {
    var Cryptor = function () {
    };

    Cryptor.encrypted = "U2FsdGVkX19VMK8gvCiEBgO+5paP1i+RLiSq5y+f/zccnqOkg65bztG1oG4BdTpQcsKA+adjRxPhgC3tr1cXJDqRIAwaBo/mu4QAdyu6XA3/7zUCKJGPRp42JNbbqWfpANwLs5ljAwvzcpRGLO+EUcQBf7TUEMZN6IgHtIs+LTPDh5D74enYrqdkfLjgNk8PDd4owEujhGh7922FWNLdtFdExIvDK6HCK+yD8OcZaILTeAIS0dGb7cWoCabZg05Sl0XnFyupeobR4vyCVJjj6tUYNQ73K2HRiDixLpymeSu/s0V8FJCwCcVCt9aG71GM2RXprObJ+uziUpqLzUNVWjwmqVoZqmWy+YWcrUz/hbJ0F16UgPi93kOCzZ4ISH0fgCA0yyerxZ9MkXjz0W+wMwJtZUnCCtFcaupz9zCA6dBtbdGMIEe3gMXvwcGYAnYPV78RN81uiJAAt/XE+NrNOZykWCw5Adic5ZyLZXialvX51GI1+fHvIDqjn8D0mRK+J21bgNkPnVSqAXzp/VulvF/wJ1diQDQDmMJs2+Lp0bI4OCrYhWZ7vHCi1Iyqk2RE1BUAaaMX8Eg2CPneB/ybMaCCnjbQt4h8++d3pCKNeINOXfxn1ySUftcKrV3J74SfVwUaJawTPbQN4WrrBDFpEMrhQ5k0dKG1SeaCvjMi97rE9DfzSSh0bkaKwrlESbz1GvMsoKjiW3Dt1CfAfqH5T8CMRK/FVBNcsxIpNK6QbarI1xyt5kgleZSHK98eyUvL0XzBYGyMZbCyozq+cMmZKammH3faZagm56RfwubWKGLRmsXT3Sbt3/nu6I5d7UhP+P+YbDwwYkGRV7Kylt6BzKpmLA7dkD/Q69aG5AixnOPP9aLbiH4C0YHYfyiVmCaqJHlk4bSM3gxUNGB1CZ+ocX/O1OLzXkp9WYdk3WU/5tv/Dyy83jDm43c7qd8USAdyoHzFe4sBpCaON9hHTPCzgiRTGodvwpdJ2G8p2kHP82U4ciNoeLnZOSzEOmVopt8XGGSyb4aeeacuOtu9CPLgrzpGByIdtdAogh3OJq0osdoC7KotNLxfLNr7UeXcIR8094k86puy9fs2qlOCKgwL9gQ0CF0+QYZnZCInzret7ee8bho8xX0lgIf9CiGuQcWIYC4s8O1HPVthIm5+0Iqe9OeQt1HZM3N/jfAZCfdCuk/PQFTsp+mJHzzla2KCDTIadrd1S086lgWczKGe+G4NfndKs9BWRl9/zHKN56/tueWy1wKGZHWvnuI1OzGdM+aAJNJ5zmxraYm9Lh4TAtsLGxqK6ExAPu+SKUimBg2cGrjDqAdgaIr7G86Da7QrmBIGW3DpXipyOeQBmlwfXZ/SSjd1DB6nvStC7TGYTF6hAz7DsCRCB16Tbm+6TI73N0hGfYKCKlIrZK3XVVskEP1xIw==";

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
        var self = this;
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        var context = new AudioContext();
        var input = context.createMediaStreamSource(stream)
        var processor = context.createScriptProcessor(1024, 1, 1);

        processor.onaudioprocess = function (e) {
            if (self.listening) {
                var voice = e.inputBuffer.getChannelData(0);
                self.sttws.send(convertoFloat32ToInt16(voice));
            }
        };

        input.connect(processor);
        processor.connect(context.destination);
    };

    Adapter.prototype.toggle = function () {
        if (this.listening) {
            document.getElementById("toggle").innerHTML = "Start";
            this.listening = false;
        } else {
            if (!this.initialized) {
                navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(this.handleSuccess).catch(function (reason) {
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
        var wsURI = "wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize"
            + "?watson-token=" + token
            + "&model=es-ES_BroadbandModel";
        this.websocket = new WebSocket(wsURI);
        this.websocket.onopen = function (evt) { onOpen(evt) };
        this.websocket.onclose = function (evt) { onClose(evt) };
        this.websocket.onmessage = function (evt) { onMessage(evt) };
        this.websocket.onerror = function (evt) { onError(evt) };
    };

    SttWs.prototype.send = function (blob) {
        this.websocket.send(blob);
        this.websocket.send({ "aciton": "stop" })
    };

    function onOpen(evt) {
        var message = {
            "action": "start",
            "content-type": "audio/l16;rate=22050"
        };
        evt.target.send(JSON.stringify(message));
    }

    function onMessage(evt) {
        console.log(evt.data);
        document.getElementById("log").innerHTML += evt.data + "\n";
    }

    function onError(evt) {
        console.log(evt.data);
        document.getElementById("log").innerHTML += evt.data + "\n";
    }

    function onClose(evt) {
        console.log(evt.data);
        document.getElementById("log").innerHTML += evt.data + "\n";
    }

    return SttWs;
})();

var adapter = null;

document.getElementById("open").addEventListener("click", function () {
    try{
        var key = document.getElementById("token").value;
        var cryptor = new Cryptor();
        var token = cryptor.decrypt(Cryptor.encrypted, key);
        var sttws = new SttWs(token);
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