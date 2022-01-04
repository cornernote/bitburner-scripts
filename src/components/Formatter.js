import {BaseComponent} from "/components/BaseComponent";

/**
 * Formatter
 */
export class Formatter extends BaseComponent {

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