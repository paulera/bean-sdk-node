'use strict'


const util = require('./util/util')
const BleServices = require('./services/services')
const async = require('async')

// Device types
const DEVICE_TYPE_LIGHT_BLUE = 'DEVICE_TYPE_LIGHT_BLUE'
const DEVICE_TYPE_BLE = 'DEVICE_TYPE_BLE'
const BEAN_UUID = 'a495ff10c5b14b44b5121370f02d74de'


function fromExistingDevice(existingDevice, peripheral) {
  /**
   * Return the same `existingDevice` instance, with updated info from peripheral
   */

  // Kind of hacky...altering "protected" state within the `existingDevice`
  let adv = peripheral.advertisement
  existingDevice._name = adv.localName ? adv.localName : ''
  existingDevice._noblePeripheral = peripheral
  return existingDevice
}


function fromNoblePeripheral(peripheral) {
  /**
   * Return a Device class given a Noble peripheral object
   */

  let adv = peripheral.advertisement
  let name = adv.localName ? adv.localName : ''
  if (adv.serviceUuids.indexOf(BEAN_UUID) == -1) {
    return new BleDevice(peripheral.uuid, name, peripheral)
  } else {
    return new LightBlueDevice(peripheral.uuid, name, peripheral)
  }
}


class BleDevice {

  constructor(uuid, name, noble_peripheral) {
    this._uuid = uuid
    this._name = name
    this._noblePeripheral = noble_peripheral

    // State
    this._services = {}
    this._autoReconnect = false
  }

  _lookupService(serviceKey) {
    /**
     * Helper function to look up a service based on a key, with error logging
     */

    let s = this._services[serviceKey]
    if (s)
      return s

    console.log(`No such service: ${serviceKey}`)
    return null
  }

  getType() {
    return DEVICE_TYPE_BLE
  }

  getUUID() {
    return this._uuid
  }

  getName() {
    return this._name
  }

  setAutoReconnect(state) {
    console.log(`Set reconnect for ${this._name}: ${state}`)
    this._autoReconnect = state
  }

  autoReconnect() {
    return this._autoReconnect
  }

  getDeviceInformationService() {
    return this._lookupService(BleServices.deviceInformation.UUID)
  }

  describe() {
    let adv = this._noblePeripheral.advertisement
    let out = `${this.getType()}:\n`
    out += `    Name: ${this._name}\n`
    out += `    UUID: ${this._uuid}\n`
    out += `    Advertised Services:\n`
    if (adv.serviceUuids.length > 0) {
      for (let i in adv.serviceUuids) {
        out += `        ${adv.serviceUuids[i]}\n`
      }
    } else {
      out += `        None\n`
    }
    return out
  }

  toString() {
    return `${this._name}(${this._uuid})`
  }

  serialize() {
    return {
      name: this._name,
      uuid: this._uuid,
      device_type: this.getType()
    }
  }

  isConnected() {
    return this._noblePeripheral.state === 'connected'
  }

  isConnectedOrConnecting() {
    return this._noblePeripheral.state === 'connected' || this._noblePeripheral.state === 'connecting'
  }

  connect(callback) {
    /**
     * Connect to the device
     *
     * @param callback Callback function that takes an error argument
     */
    console.log(`Connecting to device: ${this._name}`)
    if (this.isConnected()) {
      console.log('Already connected.')
      callback(null)
    } else {
      this._noblePeripheral.connect((err)=> {
        callback(err)
      })
    }
  }

  disconnect() {
    this._noblePeripheral.disconnect()
  }

  lookupServices(callback) {
    console.log(`Looking up services for device: ${this._name}`)

    this._noblePeripheral.discoverAllServicesAndCharacteristics((err, services) => {
      if (err) {
        console.log(`There was an error getting services: ${err}`)
        callback(err)
      } else {

        let setupFns = []

        for (let nobleService of services) {
          setupFns.push((setupCallback)=> {
            let sUUID = util.normalizeUUID(nobleService.uuid)
            let service = null
            if (this._services[sUUID]) {
              // Service exists
              service = BleServices.fromExistingService(this._services[sUUID], nobleService)
            } else {
              // New service
              service = BleServices.fromNobleService(nobleService)
            }

            service.setup((setupError)=> {
              console.log(`Service setup successfully: ${service.getName()}`)
              setupCallback(setupError)
            })

            this._services[sUUID] = service
          })
        }

        async.parallel(setupFns, function (error, results) {
          console.log('All services have been setup!')
          callback(error)
        })
      }
    })
  }
}


class LightBlueDevice extends BleDevice {
  constructor(uuid, name, services, noble_peripheral) {
    super(uuid, name, services, noble_peripheral)
  }

  getType() {
    return DEVICE_TYPE_LIGHT_BLUE
  }

  getOADService() {
    return this._lookupService(BleServices.oad.UUID)
  }

  getSerialTransportService() {
    return this._lookupService(BleServices.serialTransport.UUID)
  }

  setLed(red, green, blue) {
    let cmd = BleServices.serialTransport.commandIds.CC_LED_WRITE_ALL
    this.getSerialTransportService().sendCommand(cmd, [red, green, blue])
  }

  readAccelerometer(callback) {
    let cmd = BleServices.serialTransport.commandIds.CC_ACCEL_READ
    this.getSerialTransportService().sendCommand(cmd, [], callback)
  }

}


module.exports = {
  fromNoblePeripheral: fromNoblePeripheral,
  fromExistingDevice: fromExistingDevice,
  BleDevice: BleDevice,
  LightBlueDevice: LightBlueDevice,
  DEVICE_TYPE_LIGHT_BLUE: DEVICE_TYPE_LIGHT_BLUE,
  DEVICE_TYPE_BLE: DEVICE_TYPE_BLE
}
