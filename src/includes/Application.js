import {Formatter} from "/includes/Formatter";
import {Logger} from "/includes/Logger";
import {Cache} from "/includes/Cache";
import {ProcessManager} from "/includes/ProcessManager";

/**
 * Main Application
 */
export class Application {
    ns = null;
    components = {
        formatter: 'Formatter',
        logger: 'Logger',
        cache: 'Cache',
        processManager: 'ProcessManager',
    }

    /**
     * Initialize the application and components
     * @param {NS} ns - The nestcript instance passed to your script's main entry point
     * @param options
     */
    constructor(ns, options = {}) {
        if (!ns.print) throw 'The first argument to Application.constructor() must be an instance of "ns".';
        this.ns = ns;

        // allow override of properties
        Object.entries(options).forEach(([key, value]) => this[key] = value);

        // load components
        Object.entries(this.components).forEach(([key, value]) => {
            if (!this[key]) {
                this[key] = this.getComponent(value);
            }
        });
    }

    getComponent(options) {
        if (typeof options === 'string') {
            options = {className: options};
        }
        return eval('new ' + options.className + '(this)'); // new Formatter(this);
    }

}
