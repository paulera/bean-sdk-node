const fsm = require('../../lib/jsfsm/fsm')
const logger = require('./util/logs').logger
const util = require('./util/util')
const commandIds = require('./command-definitions').commandIds


// Sketch Uploader states
const STATE_INACTIVE = 'STATE_INACTIVE'
const STATE_AWAIT_READY = 'STATE_AWAIT_READY'
const STATE_BLOCK_TRANSFER = 'STATE_BLOCK_TRANSFER'
const STATE_AWAIT_COMPLETED = 'STATE_AWAIT_COMPLETED'
const STATE_COMPLETED = 'STATE_COMPLETED'

// Bean States
const BEAN_STATE_READY = 2
const BEAN_STATE_PROGRAMMING = 3
const BEAN_STATE_VERIFY = 4
const BEAN_STATE_COMPLETE = 5
const BEAN_STATE_ERROR = 6

// Bean Sub-state
const BEAN_SUBSTATE_INIT = 0
const BEAN_SUBSTATE_WRITE_ADDRESS = 1
const BEAN_SUBSTATE_WRITE_ADDRESS_ACK = 2
const BEAN_SUBSTATE_WRITE_CHUNK = 3
const BEAN_SUBSTATE_WRITE_CHUNK_ACK = 4
const BEAN_SUBSTATE_READ_ADDRESS = 5
const BEAN_SUBSTATE_READ_ADDRESS_ACK = 6
const BEAN_SUBSTATE_READ_CHUNK = 7
const BEAN_SUBSTATE_READ_CHUNK_ACK = 8
const BEAN_SUBSTATE_VERIFY = 9
const BEAN_SUBSTATE_DONE = 10
const BEAN_SUBSTATE_DONE_ACK = 11
const BEAN_SUBSTATE_START = 12
const BEAN_SUBSTATE_START_ACK = 13
const BEAN_SUBSTATE_HELLO = 14
const BEAN_SUBSTATE_HELLO_ACK = 15
const BEAN_SUBSTATE_START_RSTAGAIN = 16
const BEAN_SUBSTATE_DONE_RESET = 17
const BEAN_SUBSTATE_PROG_MODE = 18
const BEAN_SUBSTATE_PROG_MODE_ACK = 19
const BEAN_SUBSTATE_DEVICE_SIG = 20
const BEAN_SUBSTATE_DEVICE_SIG_ACK = 21
const BEAN_SUBSTATE_WRITE_CHUNK_TWO = 22
const BEAN_SUBSTATE_ERROR = 23


class SketchUploader {
  constructor() {
    this._process = null
  }

  beginUpload(device, sketchBuf, sketchName, callback) {
    this._process = new UploadProcess(device, sketchBuf, sketchName, callback)
    this._process.start()
  }

}


class UploadProcess extends fsm.Context {
  constructor(device, sketchBuf, sketchName, callback) {
    super()

    this._device = device
    this._sketchBuf = sketchBuf
    this._sketchName = sketchName
    this._callback = callback

    this.states = {
      STATE_INACTIVE: StateInactive,
      STATE_AWAIT_READY: StateAwaitReady,
      STATE_BLOCK_TRANSFER: StateBlockTransfer,
      STATE_AWAIT_COMPLETED: StateAwaitCompleted,
      STATE_COMPLETED: StateCompleted
    }

    this.setState(STATE_INACTIVE)
  }

  _statusCommandReceived(status) {
    
  }

  start() {
    logger.info(`Beginning sketch upload of sketch: ${this._sketchName}`)
    let serialTransport = this._device.getSerialTransportService()
    serialTransport.registerForCommandNotification(
      commandIds.BL_STATUS,
      (statusCommand) => this._statusCommandReceived(statusCommand))
    this.setState(STATE_AWAIT_READY)
  }

  getDevice() {
    return this._device
  }

  getSketchBuffer() {
    return this._sketchBuf
  }

  getSketchName() {
    return this._sketchName
  }
}


class SketchUploadState extends fsm.State {

  enterState() {}  // Override if needed

  exitState() {}  // Override if needed

}


class StateInactive extends SketchUploadState {

}


class StateAwaitReady extends SketchUploadState {
  enterState() {
    let serialTransport = this.ctx.getDevice().getSerialTransportService()
    let sketchBuf = this.ctx.getSketchBuffer()
    let sketchName = this.ctx.getSketchName()

    let cmdArgs = [
      sketchBuf.length,              // hex size
      util.crc16(sketchBuf),         // hex crc
      new Date().getTime() / 1000,   // unix timestamp
      sketchName.length,             // sketch name size
      sketchName                     // sketch name
    ]
    serialTransport.sendCommand(commandIds.BL_CMD_START, cmdArgs)
  }
}


class StateBlockTransfer extends SketchUploadState {

}


class StateAwaitCompleted extends SketchUploadState {

}


class StateCompleted extends SketchUploadState {

}


module.exports = {
  SketchUploader: SketchUploader
}
