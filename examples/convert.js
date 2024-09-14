import process from 'node:process';
import fs from 'fs/promises';
import SubtitleConvertor from '../subtitleConverter.js'

const getArgs = () => process.argv.reduce((args, arg) =>
{
    // long arg
    if (arg.slice(0, 2) === "--") {
        const longArg = arg.split("=");
        const longArgFlag = longArg[0].slice(2);
        const longArgValue = longArg.length > 1 ? longArg[1] : true;
        args[longArgFlag] = longArgValue;
    }
    // flags
    else if (arg[0] === "-")
    {
        const flags = arg.slice(1).split("");
        flags.forEach((flag) =>
        {
            args[flag] = true;
        });
    }
    return args;
}, {});

let convert = async (from = "ass", to = "srt") =>
{
    let dir = await import.meta.dirname;

    await fs.mkdir(`${dir}/input/`, { recursive: true }).catch(console.error);
    let files = await fs.readdir(`${dir}/input/`);

    for(let file of files)
    {
        if(file.endsWith(`.${from}`) === false)
        {
            continue;
        }

        let fileData = await fs.readFile(`${dir}/input/${file}`);
        let text = fileData.toString();
        let converter = new SubtitleConvertor();
        converter.subtitleText = text;
        let convertedText;

        if(from === "ass")
        {
            convertedText = converter.convertFromAss(to);
        }
        else if(from === "srt")
        {
            convertedText = converter.convertFromSrt();
            to = "vtt";
        }
        else //if(from === "vtt")
        {
            convertedText = converter.convertFromVtt();
            to = "srt";
        }


        await fs.mkdir(`${dir}/output/`, { recursive: true }).catch(console.error);
        await fs.writeFile(`${dir}/output/` + file.replace(`.${from}`, `.${to}`), convertedText);
    }
}

const args = getArgs();

if(args.from === "srt" || args.from === "vtt")
{
    convert(args.from);
}
else if(args.from === "ass")
{
    if(args.to === "srt" || args.to === "vtt")
    {
        convert(args.from, args.to);
    }
}
else
{
    convert();
}