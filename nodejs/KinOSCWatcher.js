/*
Uses uses the node osc package to watch OSC messages from the
KinectV2OSC program.

It watches the messages, keeps track of active bodies, and forwards
skeleton messages for bodies via socket.io.  It can either use a
socket.io client to emit the messages, or call a msgWatcher function
that can be defined by a socket.io server to send the messages.

Usage:

   var io = require("socket.io-client");
   var KOW = require("./js/KinOSCWatcher");
   var sioURL = "http://platonia:4000";
   var kow = new KOW.KinOSCWatcher({clientSock: io(sioURL)});

*/
var osc = require("osc");
//var io = require("socket.io-client");


function Body(id) {
    this.id = id;
    this.joints = {};
    this.confidence = {};
    this.lastTime = KinOSCWatcher.getClockTime();
}

Body.prototype.dump = function () {
    console.log("Body " + this.id);
    console.log(" joints: " + JSON.stringify(this.joints));
}

Body.prototype.getSkelMessage = function () {
    var msg = { 'msgType': 'kinect.skel', 'bodyId': this.id, 'time': this.lastTime };
    for (var jid in this.joints) {
        //var id = Body.ALL_JOINTS[jid];
        var id = Body.JOINTS[jid];
        if (!id) {
            //id = jid;
            continue;
        }
        msg[id] = this.joints[jid];
        msg[id + "_c"] = this.confidence[jid];
    }
    return msg;
}

Body.prototype.getSkelMessageHeadOnly = function (kow) {
    if (typeof kow.bodies != 'undefined')
        console.log("#!!!!!!!!!!!#Num bodies: " + Object.keys(kow.bodies).length);
    return this.lastTime + ',' + this.id + ',' + this.joints["Head"] + ',' + this.confidence["Head"] + ',';
}

Body.ALL_JOINTS = {
    'HandRight': 'RIGHT_HAND',
    'HandLeft': 'LEFT_HAND',
    'WristRight': 'RIGHT_WRIST',
    'WristLeft': 'LEFT_WRIST',
    'ElbowRight': 'RIGHT_ELBOW',
    'ElbowLeft': 'LEFT_ELBOW',
    'ShoulderRight': 'RIGHT_SHOULDER',
    'ShoulderLeft': 'LEFT_SHOULDER',
    'Neck': 'NECK',
    'Head': 'HEAD',
    'SpineMid': 'MID_SPINE',
    'SpineBase': 'BASE_SPINE',
    'HipRight': 'RIGHT_HIP',
    'HipLeft': 'LEFT_HIP',
    'KneeRight': 'RIGHT_KNEE',
    'KneeLeft': 'LEFT_KNEE',
    'AnkleRight': 'RIGHT_ANKLE',
    'AnkleLeft': 'LEFT_ANKLE',
    'FootRight': 'RIGHT_FOOT',
    'FootLeft': 'LEFT_FOOT'
};

Body.JOINTS = {
    'HandRight': 'RIGHT_HAND',
    'HandLeft': 'LEFT_HAND',
    'ElbowRight': 'RIGHT_ELBOW',
    'ElbowLeft': 'LEFT_ELBOW',
    'Head': 'HEAD'
};


///////////////////////////////////////////////////////////////

function KinOSCWatcher(opts) {
    opts = opts || {};
    this.sock = opts.clientSock;
    this.msgWatcher = opts.msgWatcher;
    this.bodies = {};
    this.lastFrameTime = 0;
    var localAddress = opts.localAddress;
    var port = opts.port || 12345;
    var inst = this;
    console.log("Listening to OSC on " + localAddress + " port " + port);
    // Bind to a UDP socket to listen for incoming OSC events.
    this.udpPort = new osc.UDPPort({
        localAddress: localAddress,
        localPort: port
    });

    this.udpPort.on("ready", function () {
        var ipAddresses = inst.getIPAddresses();
        console.log("Listening for OSC over UDP.");
        ipAddresses.forEach(function (address) {
            console.log(" Host:", address + ", Port:",
                inst.udpPort.options.localPort);
        });
        console.log("Now watching messages");
        inst.udpPort.on("message", msg => inst.handleMessage(msg));
    });
    this.udpPort.open();
    setInterval(() => inst.updateStatus(), 1000);
}

KinOSCWatcher.prototype.getStatusHTML = function () {
    var str = "KinOSCWatcher running<br>";
    return str;
}

KinOSCWatcher.getClockTime = function () {
    return new Date() / 1000.0;
}

KinOSCWatcher.prototype.handleFrameMessage = function (msg) {
    var addr = msg.address;
    var args = msg.args;
    var parts = addr.split('/');
    if (parts.length != 3 || parts[1] != "frame") {
        console.log("Unrecognized frame msg: " + JSON.stringify(msg));
        return;
    }
    this.lastFrameTime = KinOSCWatcher.getClockTime();
    var frameNum = parts[2];
}

KinOSCWatcher.prototype.handleBodiesMessage = function (msg) {
    var addr = msg.address;
    var args = msg.args;
    var parts = addr.split('/');
    var t = KinOSCWatcher.getClockTime();
    if (parts.length != 5 || parts[1] != "bodies") {
        console.log("Unrecognized bodies msg: " + JSON.stringify(msg));
        return;
    }
    //console.log("parts: "+parts);
    var bid = parts[2];
    var mtype = parts[3];
    var jid = parts[4];
    var body = this.bodies[bid];
    if (!body) {
        body = new Body(bid);
        this.bodies[bid] = body;
    }
    body.lastTime = t;
    if (mtype == "joints") {
        //console.log("body "+bid+" joint "+jid+" "+args);
        body.joints[jid] = [1000 * args[0], 1000 * args[1], 1000 * args[2]];
        var stat = args[3];
        body.confidence[jid] = stat == "Tracked" ? 1 : 0;
        if (jid == "Head") {
            var smsg = body.getSkelMessageHeadOnly(this);
            if (this.sock) {
                this.sock.emit("kinect1.skel", smsg);
            }
            if (this.msgWatcher) {
                //    this.msgWatcher("kinect2.skel", smsg);
                this.msgWatcher(smsg);
            }
        }
        return;
    }
    if (mtype == "hands") {
        //console.log("ignoring hands");
        return;
    }
    console.log("unrecognized bodies mtype: " + mtype);
}

KinOSCWatcher.prototype.updateStatus = function () {
    var t = KinOSCWatcher.getClockTime();
    var dt = t - this.lastFrameTime;
    //console.log("Last update: "+dt);
    console.log("#############Num bodies: " + Object.keys(this.bodies).length);
    var deadBodyIds = [];
    for (var id in this.bodies) {
        var body = this.bodies[id];
        var dt = t - body.lastTime;
        console.log(">>>>>id: " + id + "  dt: " + dt);
        if (dt > 5) {
            deadBodyIds.push(id);
        }
        //body.dump();
    }
    deadBodyIds.forEach(id => {
        console.log(">>>>>Removing body " + id);
        delete this.bodies[id];
    });
}

KinOSCWatcher.prototype.handleMessage = function (msg) {
    //console.log("Got msg: "+JSON.stringify(msg));
    var addr = msg.address;
    if (addr.startsWith("/bodies")) {
        this.handleBodiesMessage(msg);
    }
    else if (addr.startsWith("/frame")) {
        this.handleFrameMessage(msg);
    }
    else {
        console.log("Unexpected msg: " + JSON.stringify(msg));
    }
}

KinOSCWatcher.prototype.getIPAddresses = function () {
    var os = require("os"),
        interfaces = os.networkInterfaces(),
        ipAddresses = [];

    for (var deviceName in interfaces) {
        var addresses = interfaces[deviceName];
        for (var i = 0; i < addresses.length; i++) {
            var addressInfo = addresses[i];
            if (addressInfo.family === "IPv4" && !addressInfo.internal) {
                ipAddresses.push(addressInfo.address);
            }
        }
    }
    return ipAddresses;
};

exports.KinOSCWatcher = KinOSCWatcher;


