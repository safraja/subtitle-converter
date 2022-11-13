/**
 * Hai Form (https://github.com/safraja/hai-form) - Javascript library for converting
 * subtitles between different subtitle formats.
 * Copyright (c) 2022 Jakub Šafránek All Rights Reserved
 * @license MIT Licensed
 */


/** Subtitle converter from one format to another (currently only supports conversion from ASS to SRT). */
class SubtitleConvertor
{
    /** @type {string} - Text to convert.*/
    subtitleText;

    /** @type {string} - Converted subtitle text.*/
    convertedText = '';



    /**************** SRT/VTT parameters ****************/

    /** @type {boolean} - Indicates if ASS control codes should be removed (they are not part of SRT/VTT
     *  standard, but some players support them).*/
    stripAssControlCodes = true;

    /** @type {boolean} - Indicates whether ASS control codes that have an equivalent in SRT/VTT (namely B, I and U)
     * should be converted to tags. (This option has effect only if stripAssControlCodes === true)*/
    convertCodesToTags = true;

    /** @type {number} - Minimum duration (in milliseconds) of subtitle line, shorter lines will be ignored. This is used
     * to prevent flicking (very quick changing) of subtitle lines caused by animations used in ASS subtitles.*/
    minDuration = 300;



    /**************** VTT only parameters ****************/

    /** @type {boolean} - Indicates whether (regardless of subtitle styles) a contrasting text border
     * should be enforced. (Due to some limitations of the WebVTT format, this is highly recommended
     * for the sake of subtitle readability.)*/
    forceContrastOutline = true;

    /**
     * Converts subtitles from ASS to SRT or VTT format.
     *
     * @param {string} outputFormat - The format to which the subtitles should be converted. It can be either 'srt' (default) or 'vtt'.
     * @returns {string} - Subtitles in SRT format.
     */
    convertFromAss(outputFormat = 'srt')
    {
        this.convertedText = '';
        if(outputFormat === 'vtt')
        {
            this.convertedText = 'WEBVTT\r\n\r\n';
        }

        let lines = this.subtitleText.split(/\r?\n/).filter(element => element);
        let currentSection = '';
        let ssaFormat = null;
        let startPartIndex = null;
        let endPartIndex = null;
        let textPartIndex = null;
        let stylePartIndex = null;
        let metadata = '';
        let style = '';
        let extendedStyle = '';
        let ssaStyleFormat = null;
        let assVideoHeight = 1080;

        let parsedLines = [];

        for(let line of lines)
        {
            line = line.trim();
            if (/^\[.*]$/.test(line))
            {   // Test if line contains change of section (like [Script Info] or [Events]).
                if (currentSection === '[events]')
                {   // Events section finished - exit loop.
                    break;
                }
                else if(outputFormat === 'vtt' && currentSection === '[script info]')
                {
                    this.convertedText += `NOTE - metadata\r\n`;
                    this.convertedText += metadata;
                    this.convertedText += `\r\n\r\n`;
                }
                else if(outputFormat === 'vtt' && currentSection.endsWith('styles]'))
                {
                    this.convertedText += `STYLE\r\n`;
                    this.convertedText +=
                        `::cue{color: white;\r\nbackground-color: transparent;\r\nfont-size: 20px;` +
                        `\r\nwhite-space: normal;` +
                        `\r\ntext-shadow: 0 0 1px black, 1px 1px 0 black;\r\n}\r\n`; // Set default style.
                    this.convertedText += style;
                    this.convertedText += `\r\n\r\n`;
                }
                currentSection = line.toLowerCase();    // Otherwise change current section.
                continue;
            }

            if(currentSection !== '[events]')
            {
                if(outputFormat === 'srt')
                {   // Only events section contains relevant information for SRT.
                    continue;
                }

                if(currentSection === '[script info]')
                {
                    if(line.startsWith('PlayResY'))
                    {
                        assVideoHeight = Number(line.replace('PlayResY:', '').trim());
                    }
                    metadata += `${line}\r\n`;
                    continue;
                }

                if(currentSection.endsWith('styles]'))
                {
                    if(ssaStyleFormat === null && line.startsWith('Format:'))
                    {
                        let formatInfo = line.replace('Format:', '');
                        formatInfo = formatInfo.replace(/ /g, ''); // Remove spaces.
                        ssaStyleFormat = formatInfo.split(',');
                        continue;
                    }

                    if(line.startsWith('Style:'))
                    {
                        let styleParts = line.replace('Style:', '').split(',');
                        let generatedStyle = this.convertAssFormatsToCss(styleParts,
                            ssaStyleFormat, assVideoHeight, true);
                        style += `${generatedStyle}`;
                    }

                    continue;
                }

                continue;
            }
            if(ssaFormat === null && line.startsWith('Format:'))
            {
                let formatInfo = line.replace('Format:', '');
                formatInfo = formatInfo.replace(/ /g, ''); // Remove spaces.
                ssaFormat = formatInfo.split(',');

                startPartIndex = ssaFormat.indexOf('Start');
                endPartIndex = ssaFormat.indexOf('End');
                textPartIndex = ssaFormat.indexOf('Text');
                stylePartIndex = ssaFormat.indexOf('Style');
                continue;
            }

            if(line.startsWith('Dialogue:'))
            {
                let dialogLine = line.replace('Dialogue: ', '');
                let dialogLineParts = dialogLine.split(',');

                let startMs = this.convertTimeToMs(dialogLineParts[startPartIndex]);
                let start = this.convertTime(dialogLineParts[startPartIndex], outputFormat);
                let endMs = this.convertTimeToMs(dialogLineParts[endPartIndex]);
                let end = this.convertTime(dialogLineParts[endPartIndex], outputFormat);
                let text = dialogLineParts.splice(textPartIndex).join(',');
                text = text.trim();

                let lineStyle = '';

                if(this.stripAssControlCodes)
                {
                    if(outputFormat === 'vtt' && text.startsWith('{'))
                    {
                        // If there is only one code in the entire line (and it is at the beginning).
                        let lineCodeSearch = text.match(/^\{([^{]*?)}[^{]+$/);

                        if (lineCodeSearch !== null)
                        {
                            let styleData = lineCodeSearch[1];
                            let codes = styleData.split('\\');
                            codes.shift();  // Remove empty string.

                            let codeNames = [];
                            let codeValues = [];

                            for(let code of codes)
                            {
                                let result =
                                    code.match(/(iclop|xbord|ybord|yshad|xshad|shad|clip|blur|bord|move|pos|fax|fay|frx|fry|frz|fsp|fscx|fscy|fs|fn|fe|be|1c|2c|3c|4c|c|i|b|u|s)(.*)/);

                                if(result !== null)
                                {
                                    codeNames.push(result[1]);
                                    codeValues.push(result[2]);
                                }
                            }

                            lineStyle = this.convertAssFormatsToCss(codeValues,
                                codeNames, assVideoHeight,false);
                        }
                    }

                    if(this.convertCodesToTags)
                    {
                        let endCloseTags = [];
                        for(const tag of ['b', 'i', 'u'])
                        {
                            // Packaging control code with appropriate tag.
                            let regExp = new RegExp(`(\{[^}]*?\(${tag})1.*?}.*?\{[^}]*?\(${tag})0.*?})`, 'g');
                            text = text.replace(regExp,`<${tag}>$1</${tag}>`);
                            regExp = new RegExp(`\{[^}]*?\(${tag})1.*?}`, 'g');
                            let countOpen = (text.match(regExp) || []).length;
                            regExp = new RegExp(`\{[^}]*?\(${tag})0.*?}`, 'g');
                            let countClose = (text.match(regExp) || []).length;

                            if(countOpen > countClose)
                            {   // If detected not closed control code.
                                endCloseTags.push(tag);
                                regExp = new RegExp(`(\{[^}]*?\(${tag})1.*?})`, 'g');
                                text = text.replace(regExp,`<${tag}>$1`);
                                text = text.replace(`<${tag}><${tag}>`,`<${tag}>`);
                            }
                        }

                        for(let closeTag of endCloseTags.reverse())
                        {   // This is necessary for close tags to be in right correct order.
                            text += `</${closeTag}>`;
                        }
                    }

                    // Strip drawing commands like "{\p1}m 0 0 l 100 0 100 100 0 100{\p0}".
                    text = text.replace(/\{\\[^}]*?p\d.*?}.*?\{\\[^}]*?p0.*?}/g, '');
                    // Strip not closed drawing commands like "{\p1}m 0 0 l 100 0 100 100 0 100".
                    text = text.replace(/\{\\[^}]*?p\d.*?}.*/g, '');
                    // Strip other codes.
                    text = text.replace(/\{.*?}/g, '');
                }

                text = text.replace(/\\h/g, '\xA0');
                text = text.replace(/\\n/g, ' ');
                text = text.replace(/\\N/g, '\r\n');

                if(text.replace(/\s/g,'') === '')
                {
                    continue;   // If all text was stripped, continue with next loop.
                }

                parsedLines.push([startMs, endMs, start, end, text, dialogLineParts[stylePartIndex], lineStyle]);
            }
        }


        let sortFunc = (a, b) =>
        {
            if (a[0] === b[0])
            {
                return 0;
            }
            else
            {
                return (a[0] < b[0]) ? -1 : 1;
            }
        }

        parsedLines.sort(sortFunc);     // Sort the translation lines by their start time.

        let dialogLineIndex = 1;
        let lastLine = parsedLines.shift();

        for(let line of parsedLines)
        {
            if(lastLine[1] >= line[0])
            {   // If the previous line of subtitles ended after (or at the same time) this one began.
                if(lastLine[4] === line[4])
                {   // If two consecutive lines have the same text, join them.
                    lastLine[1] = line[1];
                    lastLine[3] = line[3];
                    continue;
                }

                if(lastLine[1] > line[0])
                {   // If the previous line of subtitles ended later than this one began, create
                    // a new line with the contents of both overlapping lines.
                    if(line[0] - lastLine[0] > this.minDuration)
                    {   // If the duration of the line is not too short, insert it.
                        if(outputFormat === 'vtt')
                        {
                            this.addTextLineVtt(dialogLineIndex, lastLine[2], line[2], lastLine[4],
                                lastLine[5]);

                            if(lastLine[6] !== '')
                            {   // Set style for specific cue.
                                extendedStyle += `::cue(#x${dialogLineIndex}) {\r\n` + lastLine[6];
                            }
                        }
                        else
                        {
                            this.addTextLine(dialogLineIndex, lastLine[2], line[2], lastLine[4]);
                        }
                        dialogLineIndex++;
                    }

                    let text = lastLine[4] + '\r\n' + line[4];

                    if(lastLine[1] - line[0] > this.minDuration)
                    {   // If the duration of the line is not too short, insert it.
                        if(outputFormat === 'vtt')
                        {
                            this.addTextLineVtt(dialogLineIndex, line[2], lastLine[3], text,
                                lastLine[5]);

                            if(lastLine[6] !== '')
                            {    // Set style for specific cue.
                                extendedStyle += `::cue(#x${dialogLineIndex}) {\r\n` + lastLine[6];
                            }
                        }
                        else
                        {
                            this.addTextLine(dialogLineIndex, line[2], lastLine[3], text);
                        }
                        dialogLineIndex++;
                    }

                    lastLine[0] = lastLine[1];
                    lastLine[1] = line[1];
                    lastLine[2] = lastLine[3];
                    lastLine[3] = line[3];
                    lastLine[4] = line[4];

                    continue;
                }
            }

            if(lastLine[1] - lastLine[0] > this.minDuration)
            {   // If the duration of the line was not too short, insert it.
                if(outputFormat === 'vtt')
                {
                    this.addTextLineVtt(dialogLineIndex, lastLine[2], lastLine[3], lastLine[4],
                        lastLine[5]);

                    if(lastLine[6] !== '')
                    {    // Set style for specific cue.
                        extendedStyle += `::cue(#x${dialogLineIndex}) {\r\n` + lastLine[6];
                    }
                }
                else
                {
                    this.addTextLine(dialogLineIndex, lastLine[2], lastLine[3], lastLine[4]);
                }
                dialogLineIndex++;
            }
            lastLine = line;
        }

        if(lastLine !== undefined && lastLine[1] - lastLine[0] > this.minDuration)
        {
            if(outputFormat === 'vtt')
            {
                this.addTextLineVtt(dialogLineIndex, lastLine[2], lastLine[3], lastLine[4],
                    lastLine[5]);

                if(lastLine[6] !== '')
                {    // Set style for specific cue.
                    extendedStyle += `::cue(#x${dialogLineIndex}) {\r\n` + lastLine[6];
                }
            }
            else
            {
                this.addTextLine(dialogLineIndex, lastLine[2], lastLine[3], lastLine[4]);
            }
            dialogLineIndex++;
        }

        this.convertedText = this.convertedText.trim() + '\r\n';

        if(extendedStyle !== '')
        {
            this.convertedText = this.convertedText.replace(style, style + extendedStyle);
        }

        return this.convertedText;
    }

    /**
     * Adds a subtitle line in SRT format.
     *
     * @param {number|string} index - Row index.
     * @param {string} start - Start time of the subtitle line.
     * @param {string} end - End state of the subtitle line.
     * @param {string} text - Line text.
     * @param {string} speaker - Speaker (used to determine the style of the translation line).
     */
    addTextLineVtt(index, start, end, text, speaker )
    {
        this.convertedText += `x${index}\r\n`;
        this.convertedText += `${start} --> ${end} line:90%\r\n`;
        this.convertedText += `<v ${speaker}>${text}\r\n\r\n`;
    }
    

    /**
     * Adds a subtitle line in SRT format.
     *
     * @param {number|string} index - Row index.
     * @param {string} start - Start time of the subtitle line.
     * @param {string} end - End state of the subtitle line.
     * @param {string} text - Line text.
     */
    addTextLine(index, start, end, text)
    {
        this.convertedText += `${index}\r\n`;
        this.convertedText += `${start} --> ${end}\r\n`;
        this.convertedText += `${text}\r\n\r\n`;
    }

    /**
     * Converts time from ASS format to SRT or VTT format.
     *
     * @param {string} time - Time to be converted.
     * @param {string} outputFormat - The format to which to convert (srt or vtt).
     * @returns {string} - Converted time.
     */
    convertTime(time, outputFormat = 'srt')
    {
        let timeParts = time.split(':');
        let secondsParts = timeParts[2].split('.');
        const seconds = secondsParts[0];
        let milliseconds = parseInt(secondsParts[1]) * 10;
        milliseconds = `${milliseconds}`.padStart(3, '0');

        if (outputFormat === 'vtt')
        {
            return `0${timeParts[0]}:${timeParts[1]}:${seconds}.${milliseconds}`;
        }

        return `0${timeParts[0]}:${timeParts[1]}:${seconds},${milliseconds}`;
    }

    /**
     * Conversion of text formats from ASS to CSS for VTT.
     *
     * @param {array<string|number>} styleParts - Array of style values.
     * @param {array<string>}ssaStyleFormat - Array with style group names (based on the CSV header).
     * @param {number} assVideoHeight - The height of the video for which the subtitles were created.
     * @param {boolean} headerData - Indicates whether the format of the header or the ASS override codes is being converted.
     * @returns {string} - Generated CSS.
     */
    convertAssFormatsToCss(styleParts, ssaStyleFormat, assVideoHeight
                           , headerData = true)
    {
        let i = 0;
        let generatedStyle = '';
        let borderSettings = {backColor: null, outlineColor: null, style: null, outline: null, shadow: null, blur: null};
        let textColor = null;

        for(let part of styleParts)
        {
            part = part.trim();

            switch (ssaStyleFormat[i])
            {
                case 'Name':
                    generatedStyle = `::cue(v[voice="${part}"]) {\r\n` + generatedStyle;
                    break;

                case 'fn':
                case 'Fontname':
                    generatedStyle += `font-family: "${part}";\r\n`;
                    break;

                case 'fs':
                case 'Fontsize':
                    let roundedSize = Math.round(part/20 * 100) / 100;
                    generatedStyle += `font-size: ${roundedSize}em;\r\n`;
                    generatedStyle +=
                        `font-size: clamp(14px, ${roundedSize}em, ${Math.round(assVideoHeight/part * 100) / 100}vmin);\r\n`;
                    break;

                case 'c':
                case '1c':
                case 'PrimaryColour':
                case 'PrimaryColor':
                    textColor = `#${this.convertAbgrToRgba(part)}`;
                    generatedStyle += `color: ${textColor};\r\n`
                    break;

                case '3c':
                case 'BackColour':
                case 'BackColor':
                    borderSettings.backColor = `#${this.convertAbgrToRgba(part)}`;
                    break;

                case '4c':
                case 'OutlineColour':
                case 'OutlineColor':
                    borderSettings.outlineColor = `#${this.convertAbgrToRgba(part)}`;
                    break;

                case 'b':
                case 'Bold':
                    if(Math.abs(part) === 1)
                    {
                        generatedStyle += `font-weight: bold;\r\n`
                    }
                    else if(Math.abs(part) > 1)
                    {
                        generatedStyle += `font-weight: ${Math.abs(part)};\r\n`
                    }
                    else
                    {
                        generatedStyle += `font-weight: normal;\r\n`
                    }
                    break;

                case 'i':
                case 'Italic':
                    if(Math.abs(part) === 1)
                    {
                        generatedStyle += `font-style: italic;\r\n`
                    }
                    else
                    {
                        generatedStyle += `font-style: normal;\r\n`
                    }
                    break;

                case 'u':
                case 'Underline':
                    if(generatedStyle.includes('text-decoration: line-through'))
                    {
                        if(Math.abs(part) === 1)
                        {
                            generatedStyle += `text-decoration: underline line-through;\r\n`
                        }
                    }
                    else
                    {
                        if(Math.abs(part) === 1)
                        {
                            generatedStyle += `text-decoration: underline;\r\n`
                        }
                        else
                        {
                            generatedStyle += `text-decoration: none;\r\n`
                        }
                    }
                    break;

                case 's':
                case 'Strikeout':
                    if(generatedStyle.includes('text-decoration: underline'))
                    {
                        if(Math.abs(part) === 1)
                        {
                            generatedStyle += `text-decoration: underline line-through;\r\n`
                        }
                    }
                    else
                    {
                        if(Math.abs(part) === 1)
                        {
                            generatedStyle += `text-decoration: line-through;\r\n`
                        }
                        else
                        {
                            generatedStyle += `text-decoration: none;\r\n`
                        }
                    }
                    break;

                case 'fsp':
                case 'Spacing':
                    generatedStyle += `letter-spacing: ${part}px;\r\n`
                    break;

                case 'BorderStyle':
                    borderSettings.style = part;
                    break;

                case 'bord':
                case 'Outline':
                    borderSettings.outline = part;
                    break;

                case 'shad':
                case 'Shadow':
                    borderSettings.shadow = part;
                    break;

                case 'be':
                case 'blur':
                    borderSettings.blur = part;
                    break;

                case 'Alignment':
                    // Possibly impossible in CSS.
                    break;

                case 'MarginL':
                    generatedStyle += `margin-left: ${part}px;\r\n`
                    break;

                case 'MarginR':
                    generatedStyle += `margin-right: ${part}px;\r\n`
                    break;

                case 'MarginV':
                    generatedStyle += `margin-bottom: ${part}px;\r\n`
                    break;

                case 'SecondaryColour':
                case 'ScaleX':
                case 'ScaleY':
                case 'Angle':
                case 'Encoding':
                    // Probably no suitable alternative in CSS.
                    break;
            }
            i++;
        }

        if(borderSettings.style === '1' || headerData === false)
        {
            let shadowValues = [];

            if(Number(borderSettings.outline) > 0 && borderSettings.outlineColor !== null)
            {
                // let outlineValue = `${Math.min(borderSettings.outline, 4)}px ${borderSettings.outlineColor}`;
                // generatedStyle += `-webkit-text-stroke: ${outlineValue};\r\n`;   Currently, not supported in a cue.
                // generatedStyle += `text-stroke: ${outlineValue};\r\n`;   Currently, not supported in a cue.
                shadowValues.push(`0 0 1px ${borderSettings.outlineColor}`);
            }

            if(Number(borderSettings.shadow) > 0 && borderSettings.backColor !== null)
            {   // There is no way in CSS to set width of shadow.
                shadowValues.push(`1px 1px 0 ${borderSettings.backColor}`);
            }

            if(Number(borderSettings.blur) > 0 && (borderSettings.outlineColor !== null || headerData === false))
            {   // There is no way in CSS to set width of shadow.
                if(borderSettings.outlineColor !== null)
                {
                    shadowValues.push(`0 0 5px ${borderSettings.outlineColor}`);
                }
                else
                {
                    shadowValues.push(`0 0 5px`);
                }
            }

            if(shadowValues.length > 0)
            {
                if(this.forceContrastOutline)
                {
                    if(textColor !== null)
                    {
                        if(this.isHexLight(textColor))
                        {
                            shadowValues.unshift(`1px 1px 0 black`);
                            shadowValues.unshift(`0 0 1px black`)
                        }
                        else
                        {
                            shadowValues.unshift(`1px 1px 0 white`);
                            shadowValues.unshift(`0 0 1px white`);
                        }
                        generatedStyle += `text-shadow: ${shadowValues.join(', ')};\r\n`;
                    }
                    // If text color can not be detected, do not use text-shadow.
                }
                else
                {
                    generatedStyle += `text-shadow: ${shadowValues.join(', ')};\r\n`;
                }

            }
            generatedStyle += `background-color: transparent;\r\n`;
        }
        else if(borderSettings.style === '3')
        {
            if(Number(borderSettings.outline) > 0)
            {
                generatedStyle += `background-color: ${borderSettings.outlineColor};\r\n`;
            }
            else if(Number(borderSettings.shadow) > 0)
            {
                generatedStyle += `background-color: ${borderSettings.backColor};\r\n`;
            }
        }
        else if(headerData)
        {
            generatedStyle += `background-color: transparent;\r\n`;
            if(this.forceContrastOutline)
            {
                if(this.isHexLight(textColor))
                {
                    generatedStyle += `text-shadow: 0 0 1px black, 1px 1px 0 white;\r\n`;
                }
                else
                {
                    generatedStyle += `text-shadow: 0 0 1px white, 1px 1px 0 white;\r\n`;
                }
            }
        }
        if(generatedStyle !== '')
        {
            generatedStyle += '}\r\n';
        }

        return generatedStyle;
    }

    /**
     * Converts ASS color format (ABGR) to standard RGBA.
     *
     * @param {string} color - The color to be converted.
     * @returns {string} - Converted hex RGBA value.
     */
    convertAbgrToRgba(color)
    {
        // color = color.replace('&H', '').replace('&', ''); Should not be necessary.
        let parts = color.match(/[a-fA-F0-9]{2}/g);
        parts = parts.reverse();
        if(parts.length === 4)  // If color contains alfa channel.
        {
            if(parts[3] === '00')
            {   // ASS seems to handle absolute transparency (00) like symbol to completely ignore transparency.
                parts[3] = 'FF';
            }
        }
        return parts.join('');
    }

    /**
     * Converts time from ASS format to milliseconds.
     *
     * @param {string} time - Time to be converted.
     * @returns {number} - Time in milliseconds.
     */
    convertTimeToMs(time)
    {
        let timeParts = time.split(':');
        let secondsParts = timeParts[2].split('.');
        let minutes = parseInt(timeParts[1]);
        let hours = parseInt(timeParts[0]);
        const seconds = parseInt(secondsParts[0]);
        let milliseconds = parseInt(secondsParts[1]) * 10;
        milliseconds += seconds * 1000 + minutes * 60 * 1000 + hours * 60 * 60 * 1000;

        return milliseconds;
    }

    /**
     * Specifies whether the specified color has a light or dark tone.
     *
     * @param color - Hex color to be tested.
     * @returns {boolean} - True, if tested color is light, otherwise false.
     */
    isHexLight(color)
    {
        const hex = color.replace('#', '');
        const cr = parseInt(hex.substring(0, 2), 16);
        const cg = parseInt(hex.substring(2, 2 + 2), 16);
        const cb = parseInt(hex.substring(4, 4 + 2), 16);
        const brightness = ((cr * 299) + (cg * 587) + (cb * 114)) / 1000;
        return brightness > 155;
    }
}

export default SubtitleConvertor;