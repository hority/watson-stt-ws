var Cryptor = (function () {
    var Cryptor = function () {
    };

    Cryptor.encrypted = "U2FsdGVkX19DuVRdSfEiBfYHF6+YaL09NS9yFsMJCiOJBPjV7XoZF1ut5LrYI8cDE5rpD3Fy3tMVTgrimgLRmyDZKsBx2WlSjxfUslgCJ2D2Ubwv19sh6sWJrZkWWDscnG9KUlZdSAkSA9kIzRJtsKCTNZ0/O9CVxqQ24OFayym68Tzr/d+B0i4HGI8af9viTZTKZl5FqLVbtJjARWwTCVFYGUCnSX/4c3HL1HadmFNovEYggHAcW/Muac/pbLRmVilRaERmOM4vyqN66/H4HunOwOoE+i2h+L2qMRuqjELjf745R3J6vH93i2y/vWjCiejz1U0uqsgEARmp/K0wrSTBic6PWldvrExrhncYgE5S0TauOvCHJ25xR/cdzzWkkmkiQC4sIGkHTY34nYYyITkaRbd40F7koQbVy1LVoVJy6kdyqMRqk1VA35qL5oWr7hA6B4NlFq9knAjVA8mpkO/FRCx36SrOZpL3on14jvSkI20UwbpcVWJ8rr/rHA0lKhPZDl2k/DJaNrX+aFabKXdJTI7AduUDVX/jWET7HsMWYhBOts0NP1Iif9W33dCypxMkkumJHOyYYX+moW/opH592xRDSHiCLTnIFq0+IDNzT1lDHDxo6YPNE0RUyRFMsq+tLvVv7X3R/cFHK1/UowlbWKof34te5HF+ntJUcF5o2SkHMoRosubvGEpq1apL+w4YEOH0jYKHBhbedlywryLDqpICSG0mcUgDqyFqJHS+RI7tyzPMc0h7XEH8yLI+CYkGWDL1ZgPTdVnKLh6wHFPuZG4bVv82/HxbduJsa1yTJrZgUtZL8Z039Er8yzsMl7z5Am/CDQ+/Ft29NHtFgdzTMPvHb2P3kmA/UuQMG+TKYbwqgppifqDi0MwFQo03GLjcyQUZqWhB+3hxpBAyCMkvrO3hEekOLkJsH5+/mPwPpmpJKljSqKqe5RHxU8hyL96e3Nn/Be+S6XlLLVzGIUpZYa1YGkWJBQkDKqw/qDBpIq2vEmy4M8se5oJ/4dKGP3/z1vQoLl+kO3TsIFIbIEM1JAKBMWbBcbc37JZL/HLFBztwS230TvZAPcYUDNJYbgx5Iu68tfc7HMySi/KUAnqWftYKNr1rSslgySKYwsyXBXOicD0lkwMCECPWTgyb8+uRZ3xGPeC1U5VLwjakYTRnbx6RePr5cjHzop5DSV/1tAZNY9O0q4wFv8ScZCKF78nPDtQLTJT+LFSccU6/pEkGEukiLmSIQ8dDIPSv7SCS94lW42fk0R1eLBxBh8deUu8zZXDOG8gWZTCuxxwn9xrQcLEwbT0QmEqJxHiA9pRshGOXiK9ddGjGb7HxBNh9dzOl2rp15VCmrFeeABFpqzeHBA1abvUt0GYw6lTZTnQa6J1JunczUG0ghAmUFAo+oCO4xAR7oHE7RXmC/1RI2bHiecut+tUZvnRRpenZsvY=";

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

    var handleSuccess = function (stream) {
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
                navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(handleSuccess).catch(function (reason) {
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
    }

    function onClose(evt) {
        console.log(evt.data);
    }

    return SttWs;
})();

var adapter = null;

document.getElementById("open").addEventListener("click", function () {
    var key = document.getElementById("token").value;
    var cryptor = new Cryptor();
    var token = cryptor.decrypt(Cryptor.encrypted, key);
    var sttws = new SttWs(token);
    adapter = new Adapter(sttws);
});

document.getElementById("toggle").addEventListener("click", function () {
    if (adapter) {
        adapter.toggle();
    }
});