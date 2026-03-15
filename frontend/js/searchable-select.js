/**
 * SearchableSelect — Reusable autocomplete dropdown component.
 * Replaces native <select> elements with a text input that filters options.
 * 
 * Usage:
 *   const ss = new SearchableSelect(containerElement, {
 *       placeholder: "Search...",
 *       options: [{value: "1", label: "Option 1"}, ...],
 *       onSelect: (value, label) => { ... },
 *       disabled: false
 *   });
 *   ss.setValue("1");            // Set value programmatically
 *   ss.getValue();              // Get current value
 *   ss.setOptions([...]);       // Replace options
 *   ss.setDisabled(true/false); // Enable/disable
 */
class SearchableSelect {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options.options || [];
        this.placeholder = options.placeholder || "Search...";
        this.onSelect = options.onSelect || (() => { });
        this.disabled = options.disabled || false;
        this.selectedValue = null;
        this.selectedLabel = "";

        this._build();
        this._attachEvents();
    }

    _build() {
        this.container.classList.add("ss-container");
        this.container.innerHTML = "";

        this.input = document.createElement("input");
        this.input.type = "text";
        this.input.className = "ss-input";
        this.input.placeholder = this.placeholder;
        this.input.autocomplete = "off";
        if (this.disabled) this.input.disabled = true;

        this.dropdown = document.createElement("div");
        this.dropdown.className = "ss-dropdown";
        this.dropdown.style.display = "none";

        this.container.appendChild(this.input);
        this.container.appendChild(this.dropdown);
    }

    _attachEvents() {
        this.input.addEventListener("focus", () => {
            if (this.disabled) return;
            this._renderDropdown(this.input.value);
            this.dropdown.style.display = "block";
        });

        this.input.addEventListener("input", () => {
            if (this.disabled) return;
            this.selectedValue = null; // Clear selection when typing
            this._renderDropdown(this.input.value);
            this.dropdown.style.display = "block";
        });

        // Close on outside click
        document.addEventListener("click", (e) => {
            if (!this.container.contains(e.target)) {
                this.dropdown.style.display = "none";
                // If nothing selected after blur, restore label or clear
                if (this.selectedValue && this.input.value !== this.selectedLabel) {
                    this.input.value = this.selectedLabel;
                }
            }
        });
    }

    _renderDropdown(query) {
        this.dropdown.innerHTML = "";
        const normalizedQuery = (query || "").toLowerCase();

        const filtered = this.options.filter(opt =>
            opt.label.toLowerCase().includes(normalizedQuery)
        );

        if (filtered.length === 0) {
            const empty = document.createElement("div");
            empty.className = "ss-item ss-empty";
            empty.textContent = "No results found";
            this.dropdown.appendChild(empty);
            return;
        }

        filtered.forEach(opt => {
            const item = document.createElement("div");
            item.className = "ss-item";
            if (opt.value === this.selectedValue) item.classList.add("ss-selected");
            item.textContent = opt.label;
            item.addEventListener("mousedown", (e) => {
                e.preventDefault(); // Prevent blur before click registers
                this.selectedValue = opt.value;
                this.selectedLabel = opt.label;
                this.input.value = opt.label;
                this.dropdown.style.display = "none";
                this.onSelect(opt.value, opt.label);
            });
            this.dropdown.appendChild(item);
        });
    }

    setValue(value) {
        const match = this.options.find(o => String(o.value) === String(value));
        if (match) {
            this.selectedValue = match.value;
            this.selectedLabel = match.label;
            this.input.value = match.label;
        }
    }

    getValue() {
        return this.selectedValue;
    }

    setOptions(options) {
        this.options = options;
        // Keep current selection if still valid
        if (this.selectedValue) {
            const still = options.find(o => String(o.value) === String(this.selectedValue));
            if (!still) {
                this.selectedValue = null;
                this.selectedLabel = "";
                this.input.value = "";
            }
        }
    }

    setDisabled(disabled) {
        this.disabled = disabled;
        this.input.disabled = disabled;
        if (disabled) this.dropdown.style.display = "none";
    }

    clear() {
        this.selectedValue = null;
        this.selectedLabel = "";
        this.input.value = "";
    }
}

// Export globally
window.SearchableSelect = SearchableSelect;
