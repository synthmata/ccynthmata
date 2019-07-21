# ccynthmata
 Generalized module for creating WebMIDI CC Controllers

 *This is still very much in beta right now - although I don't expect to make breaking changes at this point, I'm not making promises*

## Quickstart:
Include the library, initialise it during onload:

```html
<!DOCTYPE html>
<html>
    <head>
        <script src="../script/ccynthmata.js" type="text/javascript"></script>
        <script>
            // doing it this way is useful for debugging in the console as you can call on the cynth object
            var cynth;
            let init = ()=>{cynth = new Ccynthmata(); cynth.init();}
        </script>
    </head>
    <body onload="init()">
        <!-- ...etc... -->
    </body>
</html>
```

Add some `div`s for the standard interface elements to be added to:

```html
    <div class="controlitemgroup" id="midiSetup">
        <h3>Midi Device Setup</h3>
    </div>
    <div class="controlitemgroup" id="saveLoadPanel">
        <h3>Save/Load/Export/Share</h3>
    </div>
```

Add controls with the `midiccparam` class, give it a cc number to control with the `data-cclsb` attribute:

```html
<input 
    class="midiccparam" data-cclsb="63"
    max="127" min="0" type="range" >
```

If you need to target a specific channel, rather than the one selected in the interface use `data-midiChannel`

```html
<input 
    class="midiccparam" data-cclsb="63"
    data-midiChannel="1" 
    max="127" min="0" type="range" >
```

If you have 14-bit CCs specify the MSB CC with `data-ccmsb`

```html
<input 
    class="midiccparam" data-cclsb="63" data-ccmsb="31"
    data-midiChannel="1" 
    max="16383" min="0" type="range" >
```

For a more complete working example see my: [Volca Drum Editor](https://github.com/synthmata/synthmata.github.io/tree/master/volca-drum)

## TODO:
* Write the rest of the documentation
* Parameter display.

## Known Issues / Notes / Caveats
* midiCcTotal only works properly for checkable controls (radiobuttons are the obvious use case). This may be a feature rather than a bug...