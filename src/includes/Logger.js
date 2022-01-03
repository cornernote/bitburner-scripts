import {BaseComponent} from "/includes/BaseComponent";

/**
 * Logger
 */
export class Logger extends BaseComponent {
    constructor(app, options = {}) {
        super(app, options);
    }

    /**
     * Log a message, and optionally also tprint it and toast it
     * @param message
     * @param printToTerminal
     * @param toastStyle
     * @param maxToastLength
     */
    log(message = "", printToTerminal = false, toastStyle = "", maxToastLength = 100) {
        message = `[${this.app.formatter.toLocaleDateTimeString()}] ${message}`;
        this.app.ns.print(message);
        if (printToTerminal) {
            this.app.ns.tprint(message);
        }
        if (toastStyle) {
            this.app.ns.toast(message.length <= maxToastLength ? message : message.substring(0, maxToastLength - 3) + "...", toastStyle);
        }
        return message;
    }

    /**
     * Disable logs
     * @param logs
     */
    disableLogs(logs) {
        ['disableLog'].concat(...logs).forEach(log => this.app.ns.disableLog(log));
    }

}

