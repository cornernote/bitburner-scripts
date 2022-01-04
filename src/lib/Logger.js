/**
 * Logger
 */
export class Logger {

    /**
     * @type {NS}
     */
    ns = null

    /**
     * Construct the class
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, config = {}) {
        this.ns = ns;
        Object.entries(config).forEach(([key, value]) => this[key] = value); // allow override of properties in this class
    }

    /**
     * Log a message, and optionally also tprint it and toast it
     * @param message
     * @param options
     * - {Boolean} terminal - if the message should be sent to the terminal
     * - {String} toast - the toast style
     * - {Number} toastLength - the maximum length of the toast alert
     */
    log(message = "", options = {}) {
        // build message with datetime prefix
        message = `[${this.localeDateTime()}] ${message}`;
        // print to logs
        this.ns.print(message);
        // print to terminal
        if (options.terminal) {
            this.ns.tprint(message);
        }
        // throw a toast alert
        if (options.toast) {
            if (!options.toastLength) {
                options.toastLength = 100;
            }
            this.ns.toast(message.length <= options.toastLength ? message : message.substring(0, options.toastLength - 3) + "...", options.toast);
        }
        return message;
    }

    /**
     * Returns the local date and time of the given timestamp, or the current time if no timestamp is given
     * @param ms
     * @returns {string}
     */
    localeDateTime(ms = null) {
        if (ms === null) {
            ms = new Date().getTime()
        }
        let date = new Date(ms);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    /**
     * Disable logs
     * @param logs
     */
    disableLogs(logs) {
        ['disableLog'].concat(...logs).forEach(log => this.ns.disableLog(log));
    }

}

