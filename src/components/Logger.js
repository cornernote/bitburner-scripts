import {BBFW} from "/includes/BBFW";
import {BaseComponent} from "/components/BaseComponent";

/**
 * Logger
 */
export class Logger extends BaseComponent {

    /**
     * Construct the component
     *
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(config = {}) {
        super(config);
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

    /**
     * Log a message, and optionally also tprint it and toast it
     * @param message
     * @param printToTerminal
     * @param toastStyle
     * @param maxToastLength
     */
    log(message = "", printToTerminal = false, toastStyle = "", maxToastLength = 100) {
        message = `[${BBFW.app.formatter.toLocaleDateTimeString()}] ${message}`;
        BBFW.app.ns.print(message);
        if (printToTerminal) {
            BBFW.app.ns.tprint(message);
        }
        if (toastStyle) {
            BBFW.app.ns.toast(message.length <= maxToastLength ? message : message.substring(0, maxToastLength - 3) + "...", toastStyle);
        }
        return message;
    }

    /**
     * Disable logs
     * @param logs
     */
    disableLogs(logs) {
        ['disableLog'].concat(...logs).forEach(log => BBFW.app.ns.disableLog(log));
    }

}

