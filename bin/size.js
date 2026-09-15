#!/usr/bin/env node
/* The `size` entry point. Arguments and modes live in the engine: keeping them here
 * would mean the engine could not be imported without running the command. */
import { main } from '../src/size-table.js';

process.exitCode = main();
