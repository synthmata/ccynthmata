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
        // TODO: validate the channel and cc numbers here, and remove the class from elements with invalid values
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
    let ccLsb = "cclsb" in ele.dataset ? parseInt(ele.dataset.cclsb) : undefined;
    let ccMsb = "ccmsb" in ele.dataset ? parseInt(ele.dataset.ccmsb) : undefined;
    let overrideMidiChannel = ele.dataset.midichannel ? parseInt(ele.dataset.midichannel) - 1 : undefined;

    if (ele.classList.contains(MIDI_CC_PARAM_CLASS)) {
        let ccValue = parseInt(ele.value);

        return {channel: overrideMidiChannel, ccLsbNumber: ccLsb, ccMsbNumber: ccMsb, value: ccValue};
    }else if (ele.classList.contains(MIDI_CC_TOTAL_CLASS)){
        // we need to total everything for this change's cc number and channel then send it all at once
        // currently, for simplicity, this type only supports single byte cc
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

function collectPatch(){
    // collects all the parameters into an object; up to 17 keys: one for each channel and one for the user specified channel

    let patchDetails = {};
    for(let ccElement of getCcElements()){
        let ccDetails = getCcElementDetails(ccElement);
        let channel = ccDetails.channel === undefined ? 0x7f : ccDetails.channel;
        if(!(channel in patchDetails)){
            patchDetails[channel] = {}
        }
        // if we have multiple controls colliding on channel/cc the behaviour will be to use the one latest in the DOM - this is an arbitrary decision because it's
        // less code to do it that way
        console.log(ccDetails);
        if(ccDetails.ccLsbNumber !== undefined){
            
            // this should always be here, but I'm being slightly more cautious because messing up the serialization will make me sad.
            patchDetails[channel][ccDetails.ccLsbNumber] = ccDetails.value & 0x7f;
        }
        if(ccDetails.ccMsbNumber !== undefined){
            patchDetails[channel][ccDetails.ccMsbNumber] = (ccDetails.value >> 7) & 0x7f;
        }
        
    }
    return patchDetails;
}

function serializePatch(){
    // Serialized format goes like this:
    // Header
    // [Channel CCs]
    //
    // Header:
    // ------           ------          -----------
    // Offset           Length          Description
    // ------           ------          -----------
    // 0                1               Serialization version (must be 0x00)

    // Then follows a CC structure for each channel used (will often just be the user-defined channel)
    // CC Structure:
    // ------           ------          -----------    
    // Offset           Length          Description
    // ------           ------          -----------
    // 0                1               Channel number (0x00 = 1 - 0x0f = 16, 0x7f = user-defined)
    // 1                1               <parameter_count> Parameter count - 1 (ie 0 means 1 parameter present - if no parameters, channel isn't serialized at all) (max 0x7f)
    //          then <parameter_count> of:
    // 2 + (n * 2)      1               CC number
    // 3 + (n * 2)      1               CC value
    //
    // The data is then packed as per packBytes()

    let patch = collectPatch();

    let serializedRaw = [
        0x00,
    ];

    for(let channel in patch){
        serializedRaw.push(channel & 0x7f);
        let channelCcs = patch[channel]
        let paramCount = Object.keys(channelCcs).length;
        if(paramCount > 128){
            throw "illegal number of CC parameters";
        }
        serializedRaw.push(paramCount - 1);
        for(let ccNumber in channelCcs){
            serializedRaw.push(ccNumber & 0x7f);
            serializedRaw.push(channelCcs[ccNumber] & 0x7f);
        }
    }

    return packBytes(serializedRaw);

}

function packBytes(unpackedBytes){
    // This seems like overkill, but as we have to go to Base64 and incur a 4/3 size increase and 
    //  there are likely limits on query-string lengh on some server configurations, this gets us
    //  a little more space to work with with a 7/8 reduction.
    // TODO: write up some details around likely limits on size/number of parameters 
    // TODO: write unpackBytes() and test that in == out == in
    if (unpackedBytes.length === 0){
        return [];
    }
    let result = [unpackedBytes[0]];
    for(let i = 1; i < unpackedBytes.length; i++){
        let shift = i % 7;
        if(shift !== 0){
            result.push(unpackedBytes[i] >> shift)
        }
            
        let mask = 0x7f >> (7 - shift);
        result[result.length - 2] |= (unpackedBytes[i] & mask) << (8 - shift);
    }
    return result;
}

function storeOutputs(midiAccess) {
    midiOutPorts = new Array(...midiAccess.outputs.values());
}

function ccynthmataInit(){
    // Get MIDI and kick everything else off
    navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess, onMIDIFailure)
}
