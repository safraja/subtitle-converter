# Subtitle Convertor
Light (<50kB) and dependency-free javascript library for converting subtitles between different formats.

## Installation and Usage
Download the file subtitleConverter.js and import its class.

```html
<script type='module'>
    import SubtitleConvertor from '/your-path/subtitleConverter.js';
</script>
```

After thar, create an instance of subtitleConverter and save the subtitle text you want to convert into the instance
property. Then just call a conversion function you want and set the output format as via parameter.

```html
<script>
    let converter = new SubtitleConvertor();
    converter.subtitleText = assSubtitleText;
    let convertedText = converter.convertFromAss('srt'); // 'srt' => SRT, 'vtt' => WebVTT
</script>
```

Currently, there are 3 convert functions:
```js
convertFromAss(srtOrVtt); // Converts ASS format to SRT OR WebVTT
convertFromVtt(); // Converts WebTT format to SRT
convertFromSrt(); // Converts SRT format to WebTT
```

You can't choose output format when converting from SRT or WebVTT.

There are a few parameters that can be used to influence the conversion process.

### Parameters affecting conversion from ASS to SRT or WebVTT 

| Parameter            | Type (default) | Description                                                                                                                                                                                              |
|----------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| stripAssControlCodes | boolean (true) | Indicates if ASS control codes should be removed (they are not part of SRT/VTT standard, but some players support them).                                                                                 |
| convertCodesToTags   | boolean (true) | Indicates whether ASS control codes that have an equivalent in SRT/VTT (namely B, I and U) should be converted to tags. (This option has effect only if stripAssControlCodes === true.)                  |
| minDuration          | integer (300)  | Minimum duration (in milliseconds) of subtitle line, shorter lines will be ignored. This is used to prevent flicking (very quick changing) of subtitle lines caused by animations used in ASS subtitles. |

---

### Parameters affecting conversion from ASS to WebVTT

| Parameter            | Type (default) | Description                                                                                                                                                                                                      |
|----------------------|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| forceContrastOutline | boolean (true) | Indicates whether (regardless of subtitle styles) a contrasting text border should be enforced. (Due to some limitations of the WebVTT format, this is highly recommended for the sake of subtitle readability.) |
---
Example of using the parameter before starting the conversion:

```html
<script>
    let converter = new SubtitleConvertor();
    converter.subtitleText = assSubtitleText;
    converter.convertCodesToTags = false;
    let convertedText = converter.convertFromAss('vtt');
</script>
```

## License
MIT Licence
