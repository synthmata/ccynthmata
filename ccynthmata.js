var midi = null;          // global MIDIAccess object
var midiOutPorts = null;
var selectedMidiPort = null;
var selectedMidiChannel = null;

//const paramThrottleTimerMs = 30;  //if we need it

function onMIDISuccess(result) {
    console.log("MIDI ready!");
    midi = result;
    storeOutputs(midi)
    if (midiOutPorts.length < 1) {
        onMIDIFailure("No midi ports found")
    }
    console.log(midiOutPorts);
    setupParameterControls()
    buildSetupPanel()
}

function onMIDIFailure(msg) {
    alert("Could not get MIDI access.\nPlease note that MIDI in the browser currently only works in Chrome and Opera.\nIf you declined MIDI access when prompted, please refresh the page.")
    console.log("Failed to get MIDI access - " + msg);
}

function buildSetupPanel(midiAccess) {
    // Port selection.
    let former = document.createElement("form");
    former.id = "midiSetupForm"
    
    let portSelectLabel = document.createElement("label");
    portSelectLabel.textContent = "Select MIDI Device";

    let portSelecter = document.createElement("select");
    portSelecter.id = "portSelector";
    portSelecter.onchange = function (event) { 
        selectedMidiPort = midiOutPorts[event.target.value]; 
        console.log(selectedMidiPort); 
        sendSysexDump();
        //testTone();   // this is interacting with the sysex change - need to address this longterm, because I think it's useful, but disabled for now
    };
    
    portSelectLabel.appendChild(portSelecter);
    former.appendChild(portSelectLabel);
    midiOutPorts.forEach(
        function (port, idx) {
            let optioner = document.createElement("option");
            optioner.setAttribute("label", port.name);
            optioner.setAttribute("value", idx);
            portSelecter.appendChild(optioner);
        }, this);
    selectedMidiPort = midiOutPorts[0]; // TODO: check there's not a more idiomatic way of doing this

    // Channel selection
    let channelSelectLabel = document.createElement("label");
    channelSelectLabel.textContent = "Select MIDI Channel";

    let channelSelector = document.createElement("select");
    channelSelector.id = "channelSelector";
    channelSelector.onchange = function (event) { 
        selectedMidiChannel = parseInt(event.target.value); 
        console.log(selectedMidiChannel); 
        sendSysexDump();
        //testTone();  // this is interacting with the sysex change - need to address this longterm, because I think it's useful, but disabled for now
    };
    channelSelectLabel.appendChild(channelSelector);
    former.appendChild(channelSelectLabel);
    for (let i = 0; i < 16; i++) {
        let optioner = document.createElement("option");
        optioner.setAttribute("label", i + 1);
        optioner.setAttribute("value", i);
        channelSelector.appendChild(optioner);
    }
    selectedMidiChannel = 0;

    
    
    document.getElementById("midiSetup").appendChild(former);
}

function setupParameterControls() {
    for (let sysexControl of document.getElementsByClassName("midiccparam")) {
        sysexControl.oninput = handleValueChange;
    }
    // for(let sysexControl of document.getElementsByClassName("sysexParameterBitswitch")) {
    //     sysexControl.onchange = handleValueChange; // usually checkboxes and they don't have oninputs
    // }
}

function handleValueChange(event){
    if (selectedMidiChannel != null && selectedMidiPort != null) {
        let ele = event.target;
        if (event.target.classList.contains("midiccparam")) {
            let messageChannel = ele.dataset.midichannel ? parseInt(ele.dataset.midichannel) - 1 : selectedMidiChannel;
            let ccLsb = parseInt(ele.dataset.cclsb);
            let ccValue = parseInt(ele.value);

            // send lsb/single-byte
            sendCcMessage({channel: messageChannel, ccNumber: ccLsb, value: ccValue & 0x7f})
        }
    }
}

function sendCcMessage(options){
    let paramChangeMessage = [
        0xb0 | (options.channel & 0x0f),
        options.ccNumber & 0xff,
        options.value
    ];
    console.log(paramChangeMessage);
    selectedMidiPort.send(paramChangeMessage);
}

function storeOutputs(midiAccess) {
    midiOutPorts = new Array(...midiAccess.outputs.values());
}

// Get MIDI
navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess, onMIDIFailure)