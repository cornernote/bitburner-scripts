import {BaseComponent} from "/includes/BaseComponent";

/**
 * Formatter
 */
export class Formatter extends BaseComponent {

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