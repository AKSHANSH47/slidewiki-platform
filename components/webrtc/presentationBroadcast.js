import React from 'react';

class presentationBroadcast extends React.Component {

    constructor(props) {
        super(props);
        this.texts = {roleText: '', peerCountText: '', peerCount: ''};
        this.isInitiator = false;
        this.localStream = undefined;
        this.myID = undefined;
        this.presenterID = undefined;
        this.pcs = {}; // {<socketID>: {RTCConnection: RPC, dataChannel: dataChannel}, <socketID>: {RTCConnection: RPC, dataChannel: dataChannel}}
        this.turnReady = undefined;

        this.pcConfig = {
            'iceServers': [{
                'urls': 'stun:stun.l.google.com:19302' //TODO host own STUN (and TURN?) Server?
            }]
        };

        // Set up audio and video regardless of what devices are present.
        this.sdpConstraints = {
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        };

        this.room = 'foo';//TODO get it from the URL
        this.socket = undefined;

        ////////////////////////////////////////////////////// SlideWiki specific stuff
        this.iframesrc = '/Presentation/3-1/#/slide-36-2-0';//TODO get it from the URL
        this.lastRemoteSlide = this.iframesrc;
        this.paused = false; //user has manually paused slide transitions
        this.currentSlide = this.iframesrc;
    }
    componentDidMount() {
        //Remove menus as they shouldn't appear
        $('.menu:first').remove();
        $('.footer:first').remove();

        let that = this;
        that.socket = io('http://localhost:8080');

        if (that.room !== '') {
            that.socket.emit('create or join', that.room);
            console.log('Attempted to create or join room', that.room);
        }

        function setmyID() {
            if (that.myID === undefined)
                that.myID = that.socket.id;
            return that.myID;
        }

        that.socket.on('created', (room, socketID) => { //only initiator recieves this
            console.log('Created room ' + that.room);
            that.isInitiator = true;
            that.texts.roleText = 'You are the presenter, other poeple will hear your voice and reflect your presentation progress. ';
            that.texts.peerCountText = 'Peers currently listening: ';
            that.texts.peerCount = 0;
            that.forceUpdate();
            setmyID();
            $('#slidewikiPresentation').on('load', activateIframeListeners);
            requestStreams({
                audio: true,
                // video: {
                //   width: { min: 480, ideal: 720, max: 1920 },
                //   height: { min: 360, ideal: 540, max: 1080 },
                //   facingMode: "user"
                // }
            });
            swal({
                title: '<p>Room <i>' + that.room + '</i> successfully created!</p>',
                html: '<p>Other people are free to join it. At the bottom of the page is a peer counter. The current limit is 10 people.</p>',
                type: 'info',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'Check'
            }).then(() => { activateSpeechRecognition(); $('body>a#atlwdg-trigger').remove();});
        });

        that.socket.on('join', (room, socketID) => { //whole room recieves this, except for the peer that tries to join
            // a listener will join the room
            console.log('Another peer made a request to join room ' + that.room);
            if (that.isInitiator) {
                console.log('This peer is the initiator of room ' + that.room + '!');
                that.socket.emit('ID of presenter', that.room, that.myID);
            }
        });

        that.socket.on('joined', (room) => { //only recieved by peer that tries to join
            // a listener has joined the room
            console.log('joined: ' + that.room);
            setmyID();
            that.texts.roleText = 'You are now listening to the presenter. The presentation you see will reflect his progress.';
            that.forceUpdate();
            $('#slidewikiPresentation').on('load', activateIframeListeners);
            requestStreams({
                audio: false,
                video: false
            });
        });

        that.socket.on('full', (room) => { //only recieved by peer that tries to join
            console.log('Room ' + that.room + ' is full');
            that.socket.close();
            swal({
                title: 'Room full',
                html: 'This room is already full - sorry!',
                type: 'warning',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'Okay'
            });
        });

        that.socket.on('ID of presenter', (id) => {
            console.log('Received ID of presenter: ', id);
            that.presenterID = id;
        });

        that.socket.on('log', (array) => {
            setmyID();
        });

        ////////////////////////////////////////////////

        function sendMessage(cmd, data = undefined, receiver = undefined) {
            console.log('Sending message: ', cmd, data, receiver);
            that.socket.emit('message', { 'cmd': cmd, 'data': data, 'sender': that.myID, 'receiver': receiver }, that.room);
        }

        function sendRTCMessage(cmd, data = undefined, receiver = undefined) {
            let message = JSON.stringify({ 'cmd': cmd, 'data': data });
            if (receiver) { //send to one peer only
                that.pcs[receiver].dataChannel.send(message);
            } else { //broadcast from initiator
                for (let i in that.pcs) {
                    if (that.pcs[i].dataChannel) {
                        console.log('Sending Message to peer: ', i);
                        that.pcs[i].dataChannel.send(message);
                    }
                }
            }
        }

        // This client receives a message
        that.socket.on('message', (message) => {
            if (message.sender === that.myID) { //Filter for messages from myself
                if (message.cmd === 'peer wants to connect' && Object.keys(that.pcs).length === 0) { //peer triggers itself
                    start(that.presenterID);
                }
            } else if (message.receiver === that.myID) { //adressed to me
                console.log('Recieved message from peer: ', message);
                if (message.cmd === 'peer wants to connect' && that.isInitiator) { //Everyone recieves this, except for the peer itself, as soon as a peer joins, only from peer
                    start(message.sender);
                } else if (message.cmd === 'offer' || (message.cmd === 'answer' && that.isInitiator)) { //offer by initiator, answer by peer
                    that.pcs[message.sender].RTCconnection.setRemoteDescription(new RTCSessionDescription(message.data));
                    if (message.cmd === 'offer') // führt nur der peer aus
                        doAnswer(message.sender);
                }
                if (message.cmd === 'candidate') {
                    try { //Catch defective candidates
                        let candidate = new RTCIceCandidate({
                            sdpMLineIndex: message.data.label,
                            candidate: message.data.candidate
                        });
                        that.pcs[message.sender].RTCconnection.addIceCandidate(candidate).catch((e) => {}); //Catch defective candidates
                    } catch (e) {}
                }
            }
        });

        ////////////////////////////////////////////////////

        function requestStreams(options) {
            navigator.mediaDevices.getUserMedia(options)
                .then(gotStream)
                .catch((e) => {
                    gotStream('');
                    console.log('getUserMedia() error: ' + e.name);
                });
        }

        function gotStream(stream) {
            console.log('Adding local stream.');
            if (that.isInitiator) {
                //$('#videos').append('<video id="localVideo" autoplay></video>');
                //let localVideo = document.querySelector('#localVideo');
                //localVideo.srcObject = stream;
                $('#videos').remove();
            }
            that.localStream = stream;

            function sendASAP() {
                if (that.presenterID)
                    sendMessage('peer wants to connect', undefined, that.presenterID);
                else
                    setTimeout(() => { sendASAP(); }, 10);
            }
            if (!that.isInitiator) {
                sendASAP();
            }
        }

        // if (location.hostname !== 'localhost') {
        //   requestTurn(
        //     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
        //   );
        // }

        function start(peerID) {
            if (typeof that.localStream !== 'undefined') {
                console.log('creating RTCPeerConnnection for', (that.isInitiator) ? 'initiator' : 'peer');
                createPeerConnection(peerID);
                if (that.isInitiator)
                    that.pcs[peerID].RTCconnection.addStream(that.localStream);
                if (that.isInitiator)
                    doCall(peerID);
            }
        }

        window.onbeforeunload = function() {
            hangup();
        };

        /////////////////////////////////////////////////////////

        function createPeerConnection(peerID) {
            try {
                that.pcs[peerID] = {};
                that.pcs[peerID].RTCconnection = new RTCPeerConnection(null);
                that.pcs[peerID].RTCconnection.onicecandidate = handleIceCandidate.bind(that, peerID);
                that.pcs[peerID].RTCconnection.onaddstream = handleRemoteStreamAdded;
                that.pcs[peerID].RTCconnection.onremovestream = handleRemoteStreamRemoved;
                if (that.isInitiator) {
                    that.pcs[peerID].dataChannel = that.pcs[peerID].RTCconnection.createDataChannel('messages', {
                        ordered: true
                    });
                    onDataChannelCreated(that.pcs[peerID].dataChannel, peerID);
                } else {
                    that.pcs[peerID].RTCconnection.ondatachannel = handleDataChannelEvent.bind(that, peerID);
                }
                console.log('Created RTCPeerConnnection');
                if (that.isInitiator){
                    that.texts.peerCount = Object.keys(that.pcs).length;
                    that.forceUpdate();
                }
            } catch (e) {
                console.log('Failed to create PeerConnection, exception: ' + e.message);
                console.log('Cannot create RTCPeerConnection object.');
                return;
            }
        }

        function handleDataChannelEvent(peerID, event) { //called by peer
            console.log('ondatachannel:', event.channel);
            that.pcs[peerID].dataChannel = event.channel;
            that.pcs[peerID].dataChannel.onclose = handleRPCClose; //NOTE dirty workaround as browser are currently not implementing RPC.onconnectionstatechange
            onDataChannelCreated(that.pcs[peerID].dataChannel, peerID);
        }

        function handleRPCClose() {
            if (!that.isInitiator) {
                swal({
                    title: '<p>The presenter closed the session!</p>',
                    html: '<p>This presentation has ended. Feel free to look at the deck as long as you want.</p>',
                    type: 'warning',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'Check'
                });
                that.texts.roleText = 'This presentation has ended. Feel free to look at the deck as long as you want.';
                that.texts.peerCountText = '';
                that.texts.peerCount = '';
                that.forceUpdate();
                handleRemoteHangup(that.presenterID);
            }
        }

        function onDataChannelCreated(channel, peerID) { //called by peer and by initiatior
            console.log('Created data channel: ', channel, 'for ', peerID);
            /*NOTE
             * Browsers do currenty not support events that indicate whether ICE exchange has finished or not and the RPC connection has been fully established. Thus, I'm waiting for latest event onDataChannelCreated in order to close the that.socket after some time. This should be relativly safe.
             */
            if (!that.isInitiator && that.socket.disconnected === false) {
                setTimeout(() => { that.socket.close(); }, 5000); //close that.socket after 5 secs
            }

            channel.onopen = function() {
                console.log('Data Channel opened');
                if (that.isInitiator)
                    sendRTCMessage('gotoslide', that.currentSlide, peerID);
            };

            channel.onmessage = handleMessage.bind(that, channel);
        }

        function handleMessage(channel, event) {
            let data = JSON.parse(event.data);
            switch (data.cmd) {
                case 'gotoslide':
                    if (!that.isInitiator)
                        changeSlide(data.data);
                    break;
                case 'log':
                    console.log('Recieved message from peer: ', data.data);
                    break;
                case 'bye':
                    handleRemoteHangup(data.data);
                    break;
                default:

            }
        }

        function handleIceCandidate(peerID, event) {
            if (event && ((event.target && event.target.iceGatheringState !== 'complete') || event.candidate !== null)) {
                sendMessage('candidate', {
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                }, peerID);
            } else {
                console.log('End of candidates.');
            }
        }

        function handleRemoteStreamAdded(event) {
            if (that.isInitiator === false) {
                $('#videos').append('<video class="remoteVideos" autoplay></video>');
                let remoteVideos = $('.remoteVideos');
                remoteVideos[remoteVideos.length - 1].srcObject = event.stream;
            }
        }

        function handleCreateOfferError(event) {
            console.log('createOffer() error: ', event);
        }

        function doCall(peerID) { //calledy by initiatior
            that.pcs[peerID].RTCconnection.createOffer(setLocalAndSendMessage.bind(that, peerID), handleCreateOfferError);
        }

        function doAnswer(peerID) {
            that.pcs[peerID].RTCconnection.createAnswer()
                .then(
                    setLocalAndSendMessage.bind(that, peerID),
                    onCreateSessionDescriptionError
                );
        }

        function setLocalAndSendMessage(peerID, sessionDescription) {
            // Set Opus as the preferred codec in SDP if Opus is present.
            sessionDescription.sdp = preferOpus(sessionDescription.sdp);
            that.pcs[peerID].RTCconnection.setLocalDescription(sessionDescription);
            sendMessage(sessionDescription.type, sessionDescription, peerID);
        }

        function onCreateSessionDescriptionError(error) {
            trace('Failed to create session description: ' + error.toString());
        }

        function requestTurn(turnURL) {
            let turnExists = false;
            for (let i in that.pcConfig.iceServers) {
                if (that.pcConfig.iceServers[i].url.substr(0, 5) === 'turn:') {
                    turnExists = true;
                    that.turnReady = true;
                    break;
                }
            }
            if (!turnExists) {
                console.log('Getting TURN server from ', turnURL);
                // No TURN server. Get one from computeengineondemand.appspot.com:
                let xhr = new XMLHttpRequest();
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4 && xhr.status === 200) {
                        let turnServer = JSON.parse(xhr.responseText);
                        console.log('Got TURN server: ', turnServer);
                        that.pcConfig.iceServers.push({
                            'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
                            'credential': turnServer.password
                        });
                        that.turnReady = true;
                    }
                };
                xhr.open('GET', turnURL, true);
                xhr.send();
            }
        }

        function handleRemoteStreamRemoved(event) {
            console.log('Remote stream removed. Event: ', event);
        }

        function hangup() { //calledy by peer and by initiatior
            console.log('Hanging up.');
            if (that.isInitiator) {
                stop(undefined, true);
            } else {
                sendRTCMessage('bye', that.myID, that.presenterID);
                stop(that.presenterID);
            }
            //NOTE Don't need to close the socket, as the browser does this automatically if the window closes
        }

        function handleRemoteHangup(peerID) { //called by initiator
            console.log('Terminating session for ', peerID);
            stop(peerID);
        }

        function stop(peerID, presenter = false) {
            if (presenter) {
                for (let i in that.pcs) {
                    that.pcs[i].dataChannel.close();
                    that.pcs[i].RTCconnection.close();
                    delete that.pcs[i];
                }
            } else {
                that.pcs[peerID].dataChannel.close();
                that.pcs[peerID].RTCconnection.close();
                delete that.pcs[peerID];
            }
            if (that.isInitiator){
                that.texts.peerCount = Object.keys(that.pcs).length;
                that.forceUpdate();
            }
        }

        /////////////////////////////////////////// Codec specific stuff

        // Set Opus as the default audio codec if it's present.
        function preferOpus(sdp) {
            let sdpLines = sdp.split('\r\n');
            let mLineIndex;
            // Search for m line.
            for (let i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('m=audio') !== -1) {
                    mLineIndex = i;
                    break;
                }
            }
            if (mLineIndex === null) {
                return sdp;
            }

            // If Opus is available, set it as the default in m line.
            for (let i = 0; i < sdpLines.length; i++) {
                if (sdpLines[i].search('opus/48000') !== -1) {
                    let opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
                    if (opusPayload) {
                        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
                            opusPayload);
                    }
                    break;
                }
            }

            // Remove CN in m line and sdp.
            sdpLines = removeCN(sdpLines, mLineIndex);

            sdp = sdpLines.join('\r\n');
            return sdp;
        }

        function extractSdp(sdpLine, pattern) {
            let result = sdpLine.match(pattern);
            return result && result.length === 2 ? result[1] : null;
        }

        // Set the selected codec to the first in m line.
        function setDefaultCodec(mLine, payload) {
            let elements = mLine.split(' ');
            let newLine = [];
            let index = 0;
            for (let i = 0; i < elements.length; i++) {
                if (index === 3) { // Format of media starts from the fourth.
                    newLine[index++] = payload; // Put target payload to the first.
                }
                if (elements[i] !== payload) {
                    newLine[index++] = elements[i];
                }
            }
            return newLine.join(' ');
        }

        // Strip CN from sdp before CN constraints is ready.
        function removeCN(sdpLines, mLineIndex) {
            let mLineElements = sdpLines[mLineIndex].split(' ');
            // Scan from end for the convenience of removing an item.
            for (let i = sdpLines.length - 1; i >= 0; i--) {
                let payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
                if (payload) {
                    let cnPos = mLineElements.indexOf(payload);
                    if (cnPos !== -1) {
                        // Remove CN payload from m line.
                        mLineElements.splice(cnPos, 1);
                    }
                    // Remove CN line in sdp
                    sdpLines.splice(i, 1);
                }
            }

            sdpLines[mLineIndex] = mLineElements.join(' ');
            return sdpLines;
        }


        /////////////////////////////////////////// SlideWiki specific stuff

        $('#resumeRemoteControl').click(() => {
            that.paused = false;
            that.forceUpdate();
            changeSlide(that.lastRemoteSlide);
        });

        function activateIframeListeners() {
            console.log('Adding iframe listeners');
            let iframe = $('#slidewikiPresentation').contents();
            /* Currently doesn't work - Stackoverflow Question:
             * https://stackoverflow.com/questions/45457271/forward-a-keydown-event-from-the-parent-window-to-an-iframe
             */
            // $(document).keydown((event) => {
            //   console.log(event, event.keyCode);
            //   var newEvent = new KeyboardEvent("keydown", {key: event.originalEvent.key, code: event.originalEvent.code, charCode: event.originalEvent.charCode, keyCode: event.originalEvent.keyCode, which: event.originalEvent.which});
            //   //frames['slidewikiPresentation'].document.dispatchEvent(newEvent);
            //   document.getElementById("slidewikiPresentation").contentWindow.document.dispatchEvent(newEvent);
            //   //elem.dispatchEvent(event);
            //   //var e = jQuery.Event( "keydown", { keyCode: event.keyCode } );
            //   //$('#slidewikiPresentation')[0].contentWindow.$('body').trigger(e);
            // });
            if (that.isInitiator) {
                iframe.on('slidechanged', () => {
                    that.currentSlide = document.getElementById('slidewikiPresentation').contentWindow.location.href;
                    sendRTCMessage('gotoslide', that.currentSlide);
                });
            } else {
                iframe.on('slidechanged', () => {
                    if (document.getElementById('slidewikiPresentation').contentWindow.location.href !== that.lastRemoteSlide) {
                        that.paused = true;
                        that.forceUpdate();
                    }
                });
            }
        }

        function changeSlide(slideID) { // called by peers
            that.lastRemoteSlide = slideID;
            if (!that.paused) {
                console.log('Changing to slide: ', slideID);
                that.iframesrc = slideID;
                that.forceUpdate();
            }
        }

        function activateSpeechRecognition() {}
    }

    componentDidUpdate() {}

    render() {
        return (
          <div>
            <iframe id="slidewikiPresentation" src={this.iframesrc}
            height="850px" width="100%" frameBorder="0" style={{border: 0}}></iframe>
            <p>{this.texts.roleText}{this.texts.peerCountText}{this.texts.peerCount}</p>
            <button id="resumeRemoteControl" style={(this.paused) ? {} : {display: 'none'}}>Resume</button>
            <div id="videos"></div>
          </div>
        );
    }
}

presentationBroadcast.contextTypes = {
    executeAction: React.PropTypes.func.isRequired
};

export default presentationBroadcast;