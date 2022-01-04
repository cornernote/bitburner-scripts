import {BaseComponent} from "/includes/BaseComponent";

/**
 * Formatter
 */
export class Formatter extends BaseComponent {

    /**
     * Construct the component
     *
     * @param {Application} app - The application instance created in your script's main entry point
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(app, config = {}) {
        super(app, config);
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

    /**
     * Returns the local date and time of the given timestamp, or the current time if no timestamp is given
     * @param ms
     * @returns {string}
     */
    toLocaleDateTimeString(ms = null) {
        if (ms === null) {
            ms = new Date().getTime()
        }
        let date = new Date(ms);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

}