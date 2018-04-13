const KOW = require('./KinOSCWatcher')

function getClockTime() { return new Date()/1000.0; }

// example
// 
// { msgType: 'kinect.skel',
//   bodyId: '72057594037956423',
//   time: 1523580406.875,
//   HEAD: [ 141.72270894050598, -815.0498867034912, 2572.237968444824 ],
//   HEAD_c: 0,
//   LEFT_ELBOW: [ -228.5054326057434, -916.8577790260315, 2444.9963569641113 ],
//   LEFT_ELBOW_c: 0,
//   LEFT_HAND: [ -112.6270517706871, -1217.6073789596558, 2439.875364303589 ],
//   LEFT_HAND_c: 0,
//   RIGHT_ELBOW: [ 266.8997645378113, -820.5249905586243, 2468.726396560669 ],
//   RIGHT_ELBOW_c: 1,
//   RIGHT_HAND: [ 308.52577090263367, -768.5120105743408, 2171.898126602173 ],
//   RIGHT_HAND_c: 0 }

function handleChannel(channel, msg, sock) {
    console.log(channel, msg)
}

var kow = new KOW.KinOSCWatcher({msgWatcher: handleChannel, localAddress: '0.0.0.0'})
