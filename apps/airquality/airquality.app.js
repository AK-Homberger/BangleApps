const Layout = require('Layout');
//const storage = require('Storage');

const RECONNECT_TIMEOUT = 3000;

class CSCSensor {
  constructor(blecsc, display) {
    // Dependency injection
    this.blecsc = blecsc;
    this.display = display;

    // CSC runtime variables

    this.temp = 0;               // unit: °
    this.hum = 0;                // unit: %
    this.eCO2 = 0;               // unit: ppm

    // Other runtime variables
    this.connected = false;
    this.failedAttempts = 0;
    this.failed = false;

    // Layout configuration
    this.layout = 0;
    this.deviceAddress = undefined;
  }

  onDisconnect(event) {
    console.log("disconnected ", event);

    this.connected = false;
    this.setLayout(0);
    this.display.setDeviceAddress("unknown");

    this.display.setStatus("Disconnected");
    setTimeout(this.connect.bind(this), RECONNECT_TIMEOUT);
  }

  connect() {
    this.connected = false;
    this.setLayout(0);
    this.display.setStatus("Connecting");
    console.log("Trying to connect to BLE Sensor");

    // Hook up events
    this.blecsc.on('wheelEvent', this.onWheelEvent.bind(this));
    this.blecsc.on('disconnect', this.onDisconnect.bind(this));

    // Scan for BLE device and connect
    this.blecsc.connect()
      .then(function() {
        this.failedAttempts = 0;
        this.failed = false;
        this.connected = true;
        this.deviceAddress = this.blecsc.getDeviceAddress();
        console.log("Connected to " + this.deviceAddress);

        this.display.setDeviceAddress(this.deviceAddress);
        this.display.setStatus("Connected");

        // Switch to data screen in 2s
        setTimeout(function() {
          this.setLayout(1);
          this.updateScreen();
        }.bind(this), 2000);
      }.bind(this))
      .catch(function(e) {
        this.failedAttempts++;
        this.onDisconnect(e);
      }.bind(this));
  }

  disconnect() {
    this.blecsc.disconnect();
    this.reset();
    this.setLayout(0);
    this.display.setStatus("Disconnected");
  }

  setLayout(num) {
    this.layout = num;
    if (this.layout == 0) {
      this.display.updateLayout("status");
    } else if (this.layout == 1) {
      this.display.updateLayout("data");
    } 
  }

  reset() {
    this.connected = false;
    this.failed = false;
    this.failedAttempts = 0;
    this.wheelCirc = undefined;
  }

  interact(d) {
    // Only interested in tap / center button
    if (d) return;

    // Reconnect in failed state
    if (this.failed) {
      this.reset();
      this.connect();
    } else if (this.connected) {
      this.setLayout((this.layout + 1) % 2);
    }
  }

  updateScreen() {
    this.display.setCO2(this.eCO2);
    this.display.setHum(this.hum);
    this.display.setTemp(this.temp);
    this.display.setTime();
  }

  onWheelEvent(event) {
    // Get data

    this.temp= event.temp / 100;
    this.hum = event.hum / 100;
    this.eCO2 = event.eCO2 / 100;
    //console.log("Main Event",  this.eCO2);

    this.updateScreen();
  }
}

class CSCDisplay {
  constructor() {
    this.metric = true;
    this.fontLabel = "6x8";
    this.fontSmall = "15%";
    this.fontMed = "18%";
    this.fontLarge = "32%";
    this.currentLayout = "status";
    this.layouts = {};
    this.layouts.data = new Layout({
      type: "v",
      c: [
        {
          type: "h",
          id: "time_g",
          fillx: 1,
          filly: 1,
          pad: 4,
          bgCol: "#fff",
          c: [
            {type: undefined, width: 32, halign: -1},
            {type: "txt", id: "time", label: "00:00", font: this.fontLarge, bgCol: "#fff", col: "#000", width: 122},
            {type: "txt", id: "time_u", label: " ppm ", font: this.fontLabel, col: "#000", width: 22, r: 90},
          ]
        },
        {
          type: "h",
          id: "air_g",
          fillx: 1,
          pad: 4,
          bgCol: "#fff",
          height: 36,
          c: [
            {type: undefined, width: 32, halign: -1},
            {type: "txt", id: "air", label: "000", font: this.fontMed, bgCol: "#fff", col: "#000", width: 122},
            {type: "txt", id: "air_u", label: " ppm ", font: this.fontLabel, bgCol: "#fff", col: "#000", width: 22, r: 90},
          ]
        },
        {
          type: "h",
          id: "stats_g",
          fillx: 1,
          bgCol: "#fff",
          height: 36,
          c: [
            {
              type: "v",
              pad: 4,
              bgCol: "#fff",
              c: [
                {type: "txt", id: "temp_l", label: "Temp", font: this.fontLabel, col: "#000"},
                {type: "txt", id: "temp", label: "00.0", font: this.fontSmall, bgCol: "#fff", col: "#000", width: 89},
              ],
            },
            {
              type: "v",
              pad: 4,
              bgCol: "#fff",
              c: [
                {type: "txt", id: "hum_l", label: "Hum", font: this.fontLabel, col: "#000"},
                {type: "txt", id: "hum", label: "00.0", font: this.fontSmall, bgCol: "#fff", col: "#000", width: 89},
              ],
            },
            {type: "txt", id: "stats_u", label: " ", font: this.fontLabel, bgCol: "#fff", col: "#000", width: 22, r: 90},
          ]
        },
      ],
    });

    this.layouts.status = new Layout({
      type: "v",
      c: [
        {
          type: "h",
          id: "status_g",
          fillx: 1,
          bgCol: "#fff",
          height: 100,
          c: [
            {type: "txt", id: "status", label: "Bangle Cycling", font: this.fontSmall, bgCol: "#fff", col: "#000", width: 176, wrap: 1},
          ]
        },
        {
          type: "h",
          id: "addr_g",
          fillx: 1,
          pad: 4,
          bgCol: "#fff",
          height: 32,
          c: [
            { type: "txt", id: "addr_l", label: "ADDR", font: this.fontLabel, bgCol: "#fff", col: "#000", width: 36 },
            { type: "txt", id: "addr", label: "unknown", font: this.fontLabel, bgCol: "#fff", col: "#000", width: 140 },
          ]
        },
      ],
    });
  }

  updateLayout(layout) {
    this.currentLayout = layout;

    g.clear();
    this.layouts[layout].update();
    this.layouts[layout].render();
    Bangle.drawWidgets();
  }

  renderIfLayoutActive(layout, node) {
    if (layout != this.currentLayout) return;
    this.layouts[layout].render(node);
  }

  setCO2(val) {
    this.layouts.data.air.label = val;
    this.renderIfLayoutActive("data", this.layouts.data.air_g);
  }

  setHum(val) {
    this.layouts.data.hum.label = val;
    this.renderIfLayoutActive("data", this.layouts.data.stats_g);
  }

  setTemp(val) {
    this.layouts.data.temp.label = val;
    this.renderIfLayoutActive("data", this.layouts.data.stats_g);
  }

  setTime() {
    var d = new Date();
    var da = d.toString().split(" ");
    var hh = da[4].substr(0,2);
    var mm = da[4].substr(3,2);

    var time = hh + ':' + mm;

    this.layouts.data.time.label = time;
    this.renderIfLayoutActive("data", this.layouts.data.time_g);
  }

  setDeviceAddress(address) {
    this.layouts.status.addr.label = address;
    this.renderIfLayoutActive("status", this.layouts.status.addr_g);
  }

  setStatus(status) {
    this.layouts.status.status.label = status;
    this.renderIfLayoutActive("status", this.layouts.status.status_g);
  }
}

var BLECSC;
if (process.env.BOARD === "EMSCRIPTEN" || process.env.BOARD === "EMSCRIPTEN2") {
  // Emulator
  BLECSC = require("blecsc-emu");
} else {
  // Actual hardware
  BLECSC = require("blecsc");
}
var blecsc = new BLECSC();
var display = new CSCDisplay();
var sensor = new CSCSensor(blecsc, display);

E.on('kill',()=>{
  sensor.disconnect();
});

Bangle.setUI("updown", d => {
  sensor.interact(d);
});

Bangle.loadWidgets();

sensor.connect();




