/// <reference types="../../CTAutocomplete" />
/// <reference lib="es2015" />

import { addCustomCompletion } from '../../CustomTabCompletions';

export type Context = {
  originalArgs: string[],
  prevCommands: Command[]
}

export type CommandImpl = {
  fn: (args: string[], ctx: Context) => any,
  params?: (args: string[], ctx: Context) => string[],
}

export type CommandMeta = {
  description?: {
    short?: string,
    full?: string,
  },
  name: string,
  aliases?: string[],
}

export type Command = CommandImpl & CommandMeta;

export type CommandHost = {
  default?: CommandImpl,
  subcommands: Command[],
} & CommandMeta;

const cloneContext = (ctx: Context): Context => {
  return {
    originalArgs: ctx.originalArgs.slice(0),
    prevCommands: ctx.prevCommands.slice(0),
  }
}

export const filterMatchingStart = (match: string, samples: string[]) => samples.filter(s=>s.startsWith(match));

const findCommand = (name: string, commands: Command[]): Command | undefined => {
  name = name.toLowerCase();
  return commands.find(c => c.name === name || (c.aliases && c.aliases.some(n => n === name)));
}

const getCommandNames = (commands: Command[]): string[] => commands.map(c => [c.name, ...(c.aliases || [])]).reduce((a, c) => a.concat(c), []);

export const paramOptionList = (options: string[]) => (args: string[], ctx: Context): string[] => filterMatchingStart(args[0], options);

type HelpConfig = {
  injectHelp: boolean,
  colorMain: string,
  colorAccent: string,
  colorWarn: string,
}

const configDefaults: HelpConfig = {
  injectHelp: true,
  colorMain: '&a',
  colorAccent: '&b',
  colorWarn: '&c',
}

export const buildCommandHostBuilder = (userConfig: HelpConfig) => (ch: CommandHost) => buildCommandHost(ch, userConfig);

export const buildCommandHost = (ch: CommandHost, userConfig: HelpConfig = configDefaults): Command => {
  const config = { ...configDefaults, ...userConfig };
  if(config.injectHelp){
    ch.subcommands.push({
      fn: (args, ctx) => {
        let first = args[0];
        const prefix = '/' + ctx.prevCommands.map(c => c.name).join(' ');
        if(first){
          first = first.toLowerCase();
          const target = findCommand(first, ch.subcommands);
          if(!target){
            ChatLib.chat(`${config.colorMain}I can't help you with a command I don't recognize!`);
          }else{
            ChatLib.chat(`${config.colorAccent}${prefix} ${target.name} ${config.colorMain}- ${target.description?.full || target.description?.short || 'No info'}`);
          }
        }else{
          ChatLib.chat(`${config.colorMain}--- ${config.colorAccent}${prefix} commands ${config.colorMain}---`);
          for(let command of ch.subcommands){
            ChatLib.chat(`${config.colorAccent}${prefix} ${command.name} ${config.colorMain}- ${command.description?.short || 'No info'}`);
          }
        }
      },
      params: (args) => filterMatchingStart(args[0] || '', getCommandNames(ch.subcommands)),
      name: 'help',
      description: {
        short: 'this',
        full: 'Get information about about a command or a general list of commands.'
      }
    })
  }
  const cmd: Command = {
    fn: (args, otx) => {
      const ctx = cloneContext(otx);
      ctx.prevCommands.push(cmd);
      let first = args[0];
      if(!first) first = '';
      first = first.toLowerCase();
      const target = findCommand(first, ch.subcommands);
      if(target) target.fn(args.slice(1), ctx);
      else if(ch.default) ch.default.fn(args, ctx);
      else {
        const help = findCommand('help', ch.subcommands);
        const subcommands = ch.subcommands.map(c => c.name).join(`${config.colorMain}, ${config.colorAccent}`);
        if(!help) ChatLib.chat(`${config.colorWarn}Invalid subcommand, ${config.colorMain}commands are: ${config.colorAccent}${subcommands}`);
        else help.fn([], ctx);
      }
    },
    params: (args, otx) => {
      const ctx = cloneContext(otx);
      ctx.prevCommands.push(cmd);
      if(args.length < 2) return filterMatchingStart(args[0], [
        ...(ch.default?.params?.(args, ctx) || []),
        ...getCommandNames(ch.subcommands),
      ]);
      const subCommand = findCommand(args[0], ch.subcommands);
      if(!subCommand) return [];
      return subCommand.params?.(args.slice(1), ctx) || [];
    },
    name: ch.name,
    aliases: ch.aliases,
    description: ch.description,
  }
  return cmd;
}

export const registerCommand = (command: Command) => {
  const names = [command.name, ...(command.aliases || [])];
  const defaultCtx = (args: string[]) => ({ originalArgs: args.slice(0), prevCommands: [] });
  for(let name of names){
    let cmd = register('command', (...args) => command.fn(args, defaultCtx(args))).setName(name);
    if(command.params) addCustomCompletion(cmd, (args) => command.params!(args, defaultCtx(args)))
  }
}
