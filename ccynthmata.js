const MIDI_CC_PARAM_CLASS = "midiccparam";
const MIDI_CC_TOTAL_CLASS = "midicctotal";
const MIDI_CC_PARAM_CLASS_SELECTOR = "." + MIDI_CC_PARAM_CLASS;
const MIDI_CC_TOTAL_CLASS_SELECTOR = "." + MIDI_CC_TOTAL_CLASS;
const DEFAULT_SETUP_PANEL_SELECTOR = "#midiSetup";

const STANDARD_CC_CONTROL_SELECTORS = [MIDI_CC_PARAM_CLASS_SELECTOR, MIDI_CC_TOTAL_CLASS_SELECTOR];

//const paramThrottleTimerMs = 30;  //if we need it

class Ccynthmata {
    constructor(options){
        options = options || {};
        // TODO All The Options
        this._interfaceRoot = options.interfaceRoot || document;
        this._setupPanelElement = options.setupPanelElement 
            ? options.setupPanelElement 
            : this._interfaceRoot.querySelector(DEFAULT_SETUP_PANEL_SELECTOR);
        this.midi = null;          // global MIDIAccess object
        this.midiOutPorts = null;
        this.selectedMidiPort = null;
        this.selectedMidiChannel = null;
        this._ccControlSelectors = Array(...STANDARD_CC_CONTROL_SELECTORS);
    }

    init(){
        // Get MIDI and kick everything else off
        navigator.requestMIDIAccess({ sysex: true })
            //.then(this._onMIDISuccess, this._onMIDIFailure)
            .then(
                midiAccess => {
                console.log("MIDI ready!");
                this.midi = midiAccess
                this.midiOutPorts = new Array(...midiAccess.outputs.values());
                if(this.midiOutPorts.length < 1){
                    this._onMIDIFailure("No midi ports found");
                }
                this._setupParameterControls()
                this._buildSetupPanel()
            }, this._onMIDIFailure
            )
    }

    _onMIDIFailure(msg) {
        alert("Could not get MIDI access.\nPlease note that MIDI in the browser currently only works in Chrome and Opera.\nIf you declined MIDI access when prompted, please refresh the page.")
        console.log("Failed to get MIDI access - " + msg);
    }
    
    _buildSetupPanel() {
        // Port selection.
        let former = document.createElement("form");
        former.id = "midiSetupForm"
        
        let portSelectLabel = document.createElement("label");
        portSelectLabel.textContent = "Select MIDI Device";
    
        let portSelecter = document.createElement("select");
        portSelecter.id = "portSelector";
        portSelecter.onchange = function (event) { 
            this.selectedMidiPort = this.midiOutPorts[event.target.value]; 
            console.log(this.selectedMidiPort); 
            //sendSysexDump(); // TODO: send whole patch
        };
        
        portSelectLabel.appendChild(portSelecter);
        former.appendChild(portSelectLabel);
        this.midiOutPorts.forEach(
            function (port, idx) {
                let optioner = document.createElement("option");
                optioner.setAttribute("label", port.name);
                optioner.setAttribute("value", idx);
                portSelecter.appendChild(optioner);
            }, this);
        this.selectedMidiPort = this.midiOutPorts[0]; 
    
        // Channel selection
        let channelSelectLabel = document.createElement("label");
        channelSelectLabel.textContent = "Select MIDI Channel";
    
        let channelSelector = document.createElement("select");
        channelSelector.id = "channelSelector";
        channelSelector.onchange = function (event) { 
            this.selectedMidiChannel = parseInt(event.target.value); 
            console.log(this.selectedMidiChannel); 
            //sendSysexDump(); // TODO: send whole patch
        };
        channelSelectLabel.appendChild(channelSelector);
        former.appendChild(channelSelectLabel);
        for (let i = 0; i < 16; i++) {
            let optioner = document.createElement("option");
            optioner.setAttribute("label", i + 1);
            optioner.setAttribute("value", i);
            channelSelector.appendChild(optioner);
        }
        this.selectedMidiChannel = 0;
    
        this._setupPanelElement.appendChild(former);
    }

    _setupParameterControls() {
        for(let ccControl of this.getCcElements()){
            // TODO: validate the channel and cc numbers here, and remove the class from elements with invalid values
            if(!this.tryAttachParameterChangeHandler(ccControl)){
                console.log(`Couldn't attach parameter watcher to ${ccClass} control:`)
                console.log(ccControl);
            }
        }
    }

    *getCcElements(){
        for(let ccSelector of this._ccControlSelectors){
            //for (let ccControl of this._interfaceRoot.getElementsByClassName(ccClass)) {
                for (let ccControl of this._interfaceRoot.querySelectorAll(ccSelector)) {
                yield ccControl;
            }
        }
    }

    tryAttachParameterChangeHandler(ccControl){
        // TODO: work down full list of useful change events
        if("oninput" in ccControl){
            ccControl.oninput = ev => this._handleValueChange(ev);
            return true;
        }else if("onchange" in ccControl){
            ccControl.onchange = ev => this._handleValueChange(ev);
            return true;
        }
        return false;
    }
    
    getTotallerElements(ccLsb, channel){
        channel = channel === undefined ? null : channel;
        return [...this._interfaceRoot.querySelectorAll(MIDI_CC_TOTAL_CLASS_SELECTOR)]
                .filter(
                    x => parseInt(x.dataset.cclsb) === ccLsb && ((channel === null && !x.dataset.midichannel) || channel === parseInt(x.dataset.midichannel) - 1));
    }

    getCcElementDetails(ele){
        let ccLsb = "cclsb" in ele.dataset ? parseInt(ele.dataset.cclsb) : undefined;
        let ccMsb = "ccmsb" in ele.dataset ? parseInt(ele.dataset.ccmsb) : undefined;
        let overrideMidiChannel = ele.dataset.midichannel ? parseInt(ele.dataset.midichannel) - 1 : undefined;
    
        if (ele.classList.contains(MIDI_CC_PARAM_CLASS)) {
            let ccValue = parseInt(ele.value);
    
            return {channel: overrideMidiChannel, ccLsbNumber: ccLsb, ccMsbNumber: ccMsb, value: ccValue};
        }else if (ele.classList.contains(MIDI_CC_TOTAL_CLASS)){
            // we need to total everything for this change's cc number and channel then send it all at once
            // currently, for simplicity, this type only supports single byte cc
            
            let toTotal = this.getTotallerElements(ccLsb, overrideMidiChannel);
            let ccSum = toTotal.reduce((sum, x) => sum + ("checked" in x ? (x.checked ? parseInt(x.value) : 0) : parseInt(value)), 0);
            
            return {channel: overrideMidiChannel, ccLsbNumber: ccLsb, value: ccSum & 0x7f};
        }
        else{
            throw `unknown cc element class on ${ele}`;
        }
    }
    
    _handleValueChange(event){
        if (this.selectedMidiChannel != null && this.selectedMidiPort != null) {
            let ele = event.target;
            let ccElementDetails = this.getCcElementDetails(ele);
            this.sendCcMessage(ccElementDetails);
        }
    }
    
    sendCcMessage(ccElementDetails){
        //console.log("sendCcMessage")
        let channel = ccElementDetails.channel === undefined ? this.selectedMidiChannel : ccElementDetails.channel;
        if(ccElementDetails.ccMsbNumber !== undefined){
            this._sendCcMessage({channel: channel, ccNumber: ccElementDetails.ccMsbNumber, value: (ccElementDetails.value >> 7) & 0x7f});
        }
        this._sendCcMessage({channel: channel, ccNumber: ccElementDetails.ccLsbNumber, value: ccElementDetails.value & 0x7f});
    }
    
    _sendCcMessage(options){
        let paramChangeMessage = [
            0xb0 | (options.channel & 0x0f),
            options.ccNumber & 0x7f,
            options.value & 0x7f
        ];
        console.log(paramChangeMessage);
        this.selectedMidiPort.send(paramChangeMessage);
    }

    collectPatch(){
        // collects all the parameters into an object; up to 17 keys: one for each channel and one for the user specified channel
        let patchDetails = {};
        for(let ccElement of this.getCcElements()){
            let ccDetails = this.getCcElementDetails(ccElement);
            let channel = ccDetails.channel === undefined ? 0x7f : ccDetails.channel;
            if(!(channel in patchDetails)){
                patchDetails[channel] = {}
            }
            // if we have multiple controls colliding on channel/cc the behaviour will be to use the one latest in the DOM - this is an arbitrary decision because it's
            // less code to do it that way
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
    
    serializePatch(){
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
    
        let patch = this.collectPatch();
    
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
    
        return Ccynthmata.packBytes(serializedRaw);
    }
    
    deserializePatch(packedData){
        let data = Ccynthmata.unpackBytes(packedData);
        console.log(data);
        if(data[0] !== 0){
            throw "unknown patch data version";
        }
        let patch = {};
        let i = 1;
        while(i < data.length - 2){
            let channel = data[i++];
            //console.log(`Deserialize: channel is ${channel}`)
            if(channel != 0x7f && channel > 0x0f){
                throw `invalid midi channel number ${channel}`;
            }
            let count = data[i++] + 1;
            //console.log(`Deserialize: count is ${count}`)
            patch[channel] = {};
            for(let j = 0; j < count; j++){
                patch[channel][data[i]] = data[i + 1];
                i += 2;
            }
        }
        return patch;
    }

    setCcValue(ccControl, value, isMsb=false){
        if(ccControl.classList.contains(MIDI_CC_PARAM_CLASS)){
            let currentValue = parseInt(ccControl.value);
            if(isMsb){
                currentValue &= 0x7F;
                ccControl.value = currentValue | ((value & 0x7f) << 7)
            }else{
                currentValue &= 0x3f80;
                ccControl.value = currentValue | (value & 0x7f);
            }
            
        }else if(ccControl.classList.contains(MIDI_CC_TOTAL_CLASS)){
            // Note/Known Issue: currently this will only work for checkable controls
            
            let toTotal = this.getTotallerElements(
                parseInt(ccControl.dataset.cclsb), parseInt(ccControl.dataset.midichannel) - 1).filter(x => "checked" in x);
            toTotal.sort((a, b) => parseInt(b.value) - parseInt(a.value));
            
            let appliedNames = new Set(); // used to stop touching radiobuttons in a group once the highest applicable has been set
            for(let totee of toTotal){
                let controlValue = parseInt(totee.value)
                if(value >= controlValue){
                    if(!totee.name || !appliedNames.has(totee.name)){  // handling radiobuttons
                        totee.checked = true;
                        value -= controlValue;
                        if(totee.name){
                            appliedNames.add(totee.name);
                        }
                    }
                }else{
                    totee.checked = false;
                }
            }
            if(value != 0){
                console.log(`Warning: didn't exhaust the total when applying to midiCcTotal controls for cc ${ccControl.dataset.cclsb}`);
            }
        }
    }

    applyPatch(patch){
        // input should be in the same format as the output from collectPatch()
        // this is useful to know - if you wanted to plonk the result of a JSON
        // response from a server into the interface - this is your doorway in

        // we get all the controls and look them up in the patch rather than the other way around
        let missCount = 0;
        for(let ccControl of this.getCcElements()){
            let details = this.getCcElementDetails(ccControl);
            let channel = details.channel !== undefined ? details.channel : 0x7f;
            if(!(channel in patch)){
                console.log(`Couldn't get channel ${channel} from patch`);
                missCount++;
                continue;
            }
            if(details.ccLsbNumber !== undefined){
                let lsbValue = patch[channel][details.ccLsbNumber];
                if(lsbValue === undefined){
                    console.log(`couldn't get cc ${details.ccLsbNumber} for channel ${channel}`);
                    missCount++;
                }else{
                    this.setCcValue(ccControl, lsbValue);
                }
            }

            if(details.ccMsbNumber !== undefined){
                let msbValue = patch[channel][details.ccMsbNumber];
                if(msbValue === undefined){
                    console.log(`couldn't get cc ${details.ccMsbNumber} for channel ${channel}`);
                    missCount++;
                }else{
                    this.setCcValue(ccControl, msbValue, true);
                }
            }
            
        }
        console.log(`Missed ${missCount} values.`)
    }

    static packBytes(unpackedBytes){
        // This seems like overkill, but as we have to go to Base64 and incur a 4/3 size increase and 
        //  there are likely limits on query-string lengh on some server configurations, this gets us
        //  a little more space to work with with a 7/8 reduction.
        // TODO: write up some details around likely limits on size/number of parameters 
        // TODO: write unpackBytes() and test that in == out == in
        if (unpackedBytes.length === 0){
            return [];
        }
        let result = [];
        let current = 0;
        let prev = 0;
        let shift;
        for(let i = 0; i < unpackedBytes.length; i++){
            if(unpackedBytes[i] > 127){
                throw "Cannot pack values over 127 (0x7f)";
            }
            shift = i % 8;
            if(shift == 0){
                prev = unpackedBytes[i] & 0x7f;
                continue;
            }
            current = (unpackedBytes[i] << (8 -shift)) & 0xff
            result.push(current | prev);
            prev = unpackedBytes[i] >> shift

        }
        result.push(prev);

        return result;
        
    }

    static unpackBytes(packedBytes){
        let result = [];
        let last = 0;
        let current = 0;
        for(let i = 0; i < packedBytes.length; i++){
            let shift = i % 7;
            let lowerMask = 0x7f >> shift;
            let upperMask = (0xff80 >>  shift) & 0xff;
            
            if(i > 0 && shift == 0){
                result.push(last)
                last = 0;
            }
            current = (packedBytes[i] & lowerMask) << shift;

            result.push(current | last);
            
            last = (packedBytes[i] & upperMask) >> (7 - shift);
        }
        return result;
    }
}
