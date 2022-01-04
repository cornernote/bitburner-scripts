import {BaseComponent} from "/components/BaseComponent";
import {StringHelper} from "/components/StringHelper";
import {DateHelper} from "/components/DateHelper";
import {Logger} from "/components/Logger";
import {Cache} from "/components/Cache";

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
     * Extra components to be initialized, all probably have `@MEM >0GB`
     * @type {Object}
     */
    components = {}

    /**
     * Core components to be initialized, all should have `@MEM 0GB`
     * @type {Object}
     */
    coreComponents = {
        stringHelper: StringHelper,
        dateHelper: DateHelper,
        logger: Logger,
        cache: Cache,
    }

    /**
     * @type {StringHelper}
     */
    stringHelper = null

    /**
     * @type {DateHelper}
     */
    dateHelper = null

    /**
     * @type {Logger}
     */
    logger = null

    /**
     * @type {Cache}
     */
    cache = null

    /**
     * @type {TaskManager}
     */
    taskManager = null

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

        // load extra components
        Object.entries(this.components).forEach(([key, value]) => {
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
     * @param config
     * @returns {any}
     */
    createComponent(config) {
        if (config.prototype && config.prototype instanceof BaseComponent) {
            return new config(this);
        }
        if (config.className.prototype && config.className.prototype instanceof BaseComponent) {
            let className = config.className;
            delete config.className;
            return new className(this, config);
        }
        this.ns.tprint('could not createComponent for the following config:');
        this.ns.tprint(config);
        throw 'could not createComponent!';
    }

}
