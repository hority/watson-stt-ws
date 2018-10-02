var Adapter = (function(){
    var Adapter = function(sttws){
        this.initialized = false;
        this.listening = false;
        this.sttws = sttws;
    };

    var convertoFloat32ToInt16 = function(buffer) {
        var l = buffer.length;
        var buf = new Int16Array(l)

        while (l--) {
            buf[l] = buffer[l] * 0xFFFF;    //convert to 16 bit
        }
        return buf.buffer
    };

    var handleSuccess = function (stream) {
        var context = new AudioContext();
        var input = context.createMediaStreamSource(stream)
        var processor = context.createScriptProcessor(1024, 1, 1);

        processor.onaudioprocess = function (e) {
            if (listening) {
                var voice = e.inputBuffer.getChannelData(0);
                this.sttws.send(convertoFloat32ToInt16(voice));
            }
        };

        input.connect(processor);
        processor.connect(context.destination);
    };

    Adapter.prototype.toggle = function(){
        if(this.listening){
            document.getElementById("toggle").innerHTML = "Start";
            this.listening = false;
        } else {
            if(!this.initialized){
                navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(handleSuccess).catch(function(reason){
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

var SttWs = (function(){
    var SttWs = function(token){
        var wsURI = "wss://stream.watsonplatform.net/speech-to-text/api/v1/recognize"
            + "?watson-token=" + token
            + "&model=es-ES_BroadbandModel";
        this.websocket = new WebSocket(wsURI);
        this.websocket.onopen = function (evt) { onOpen(evt) };
        this.websocket.onclose = function (evt) { onClose(evt) };
        this.websocket.onmessage = function (evt) { onMessage(evt) };
        this.websocket.onerror = function (evt) { onError(evt) };
    };

    SttWs.prototype.send = function(blob) {
        this.websocket.send(blob);
        this.websocket.send({ "aciton": "stop" })
    };

    function onOpen(evt) {
        var message = {
            "action": "start",
            "content-type": "audio/l16;rate=22050"
        };
        this.websocket.send(JSON.stringify(message));
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

document.getElementById("open").addEventListener("click", function () {
    var token = document.getElementById("token").value;
    var sttws = new SttWs(token);
    var adapter = new Adapter(sttws);
    documeng.getElementById("toggle").addEventListener("click",function(){
        adapter.toggle();
    });
});