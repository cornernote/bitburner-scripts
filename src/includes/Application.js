import {Formatter} from "/includes/Formatter";
import {Logger} from "/includes/Logger";
import {Cache} from "/includes/Cache";
import {StringHelper} from "/includes/StringHelper";

/**
 * Application
 *
 * The application class gives easy access to common components such as formatting, logging, and caching.
 */
export class Application {

    /**
     * The NS instance the application is running on.
     * @type {NS}
     */
    ns = null

    /**
     * @type {boolean}
     */
    verbose = false

    /**
     * Core components to be initialized, all should have `@MEM 0GB`
     * @type {Object}
     */
    coreComponents = {
        formatter: 'Formatter',
        logger: 'Logger',
        cache: 'Cache',
        stringHelper: 'StringHelper',
    }

    /**
     * @type {Formatter}
     */
    formatter = null

    /**
     * @type {Logger}
     */
    logger = null

    /**
     * @type {Cache}
     */
    cache = null

    /**
     * @type {StringHelper}
     */
    stringHelper = null

    /**
     * Initialize the application and components
     *
     * @param {NS} ns - The nestcript instance passed to your script's main entry point
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, config = {verbose: false}) {
        if (!ns.print) throw 'The first argument to Application.constructor() must be an instance of "ns".';
        this.ns = ns;

        // allow override of properties
        Object.entries(config).forEach(([key, value]) => this[key] = value);

        // load core components
        Object.entries(this.coreComponents).forEach(([key, value]) => {
            if (!this[key]) {
                this[key] = this.createComponent(value);
            }
        });

        // Log start/end!
        if (this.verbose) {
            this.logger.log('Application Started', true);
            // let app = this; ns.atExit(() => app.logger.log('Application Ended', true)); // doesn't work, i think NS is unloaded :(
        }
    }

    /**
     * Creates an application component
     *
     * @param options
     * @returns {any}
     */
    createComponent(options) {
        if (typeof options === 'string') {
            options = {className: options};
        }
        return eval('new ' + options.className + '(this)'); // new Formatter(this);
    }

}
