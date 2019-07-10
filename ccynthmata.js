const MIDI_CC_PARAM_CLASS = "midiccparam";
const MIDI_CC_TOTAL_CLASS = "midicctotal";

const standardControls = [MIDI_CC_PARAM_CLASS, MIDI_CC_TOTAL_CLASS];

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
    selectedMidiPort = midiOutPorts[0]; 

    // Channel selection
    let channelSelectLabel = document.createElement("label");
    channelSelectLabel.textContent = "Select MIDI Channel";

    let channelSelector = document.createElement("select");
    channelSelector.id = "channelSelector";
    channelSelector.onchange = function (event) { 
        selectedMidiChannel = parseInt(event.target.value); 
        console.log(selectedMidiChannel); 
        sendSysexDump();
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

function tryAttachParameterChangeHandler(ccControl){
    // TODO: work down full list of useful change events
    if("oninput" in ccControl){
        ccControl.oninput = handleValueChange;
        return true;
    }else if("onchange" in ccControl){
        ccControl.onchange = handleValueChange;
        return true;
    }
    return false;
}

function setupParameterControls() {
    for(let ccControl of getCcElements()){
        if(!tryAttachParameterChangeHandler(ccControl)){
            console.log(`Couldn't attach parameter watcher to ${ccClass} control:`)
            console.log(ccControl);
        }
    }
}

function* getCcElements(){
    for(ccClass of standardControls){
        for (let ccControl of document.getElementsByClassName(ccClass)) {
            yield ccControl;
        }
    }
}

function getCcElementDetails(ele){
    if (ele.classList.contains(MIDI_CC_PARAM_CLASS)) {
        //let messageChannel = ele.dataset.midichannel ? parseInt(ele.dataset.midichannel) - 1 : selectedMidiChannel;
        let overrideMidiChannel = ele.dataset.midichannel ? parseInt(ele.dataset.midichannel) - 1 : undefined;
        let ccLsb = parseInt(ele.dataset.cclsb);
        let ccMsb = parseInt(ele.dataset.ccmsb);
        let ccValue = parseInt(ele.value);

        // TODO: Handle 14-bit parameters
        
        // send lsb/single-byte
        return {channel: overrideMidiChannel, ccLsbNumber: ccLsb, ccMsbNumber: ccMsb, value: ccValue};
    }else if (ele.classList.contains(MIDI_CC_TOTAL_CLASS)){
        // we need to total everything for this change's cc number and channel then send it all at once
        // currently, for simplicity, this type only supports single byte cc
        let ccLsb = parseInt(ele.dataset.cclsb);
        let overrideMidiChannel = ele.dataset.midichannel ? parseInt(ele.dataset.midichannel) - 1 : undefined;
        
        let toTotal = [...document.getElementsByClassName(MIDI_CC_TOTAL_CLASS)]
            .filter(
                x => parseInt(x.dataset.cclsb) === ccLsb && ((overrideMidiChannel === null && !x.dataset.midichannel) || overrideMidiChannel === parseInt(x.dataset.midichannel) - 1));
        let ccSum = toTotal.reduce((sum, x) => sum + ("checked" in x ? (x.checked ? parseInt(x.value) : 0) : parseInt(value)), 0);
        
        return {channel: overrideMidiChannel, ccLsbNumber: ccLsb, value: ccSum & 0x7f};
    }
    else{
        throw `unknown cc element class on ${ele}`;
    }
}

function handleValueChange(event){
    if (selectedMidiChannel != null && selectedMidiPort != null) {
        let ele = event.target;
        let ccElementDetails = getCcElementDetails(ele);
        sendCcMessage(ccElementDetails);
    }
}

function sendCcMessage(ccElementDetails){
    let channel = ccElementDetails.channel === undefined ? selectedMidiChannel : ccElementDetails.channel;
    if(ccElementDetails.ccMsbNumber !== undefined){
        _sendCcMessage({channel: channel, ccNumber: ccElementDetails.ccMsbNumber, value: (ccElementDetails.value >> 7) & 0x7f});
    }
    _sendCcMessage({channel: channel, ccNumber: ccElementDetails.ccLsbNumber, value: ccElementDetails.value & 0x7f});
}

function _sendCcMessage(options){
    let paramChangeMessage = [
        0xb0 | (options.channel & 0x0f),
        options.ccNumber & 0x7f,
        options.value & 0x7f
    ];
    console.log(paramChangeMessage);
    selectedMidiPort.send(paramChangeMessage);
}



function storeOutputs(midiAccess) {
    midiOutPorts = new Array(...midiAccess.outputs.values());
}

function ccynthmataInit(){
    // Get MIDI and kick everything else off
    navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess, onMIDIFailure)
}
