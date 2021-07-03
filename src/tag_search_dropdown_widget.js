// Handle showing the search history and tag edit dropdowns.
class tag_search_box_widget
{
    constructor(container)
    {
        this.input_onfocus = this.input_onfocus.bind(this);
        this.input_onblur = this.input_onblur.bind(this);
        this.container_onmouseenter = this.container_onmouseenter.bind(this);
        this.container_onmouseleave = this.container_onmouseleave.bind(this);
        this.submit_search = this.submit_search.bind(this);

        this.container = container;
        this.input_element = this.container.querySelector(".search-tags");

        this.dropdown_widget = new tag_search_dropdown_widget(container);
        this.edit_widget = new tag_search_edit_widget(container);

        this.container.addEventListener("mouseenter", this.container_onmouseenter);
        this.container.addEventListener("mouseleave", this.container_onmouseleave);
        this.input_element.addEventListener("focus", this.input_onfocus);
        this.input_element.addEventListener("blur", this.input_onblur);

        let edit_button = this.container.querySelector(".edit-search-button");
        if(edit_button)
        {
            edit_button.addEventListener("click", (e) => {
                // Toggle the edit widget, hiding the search history dropdown if it's shown.
                if(this.dropdown_widget.shown)
                    this.hide();

                if(this.edit_widget.shown)
                    this.hide();
                else
                    this.show_edit();
            });
        }
        
        // Search submission:
        helpers.input_handler(this.input_element, this.submit_search);
        this.container.querySelector(".search-submit-button").addEventListener("click", this.submit_search);

        // Hide the dropdowns on navigation.
        new view_hidden_listener(this.input_element, (e) => {
            this.hide();
        });
    }

    async show_history()
    {
        // Don't show history if search editing is already open.
        if(this.edit_widget.shown)
            return;

        this.dropdown_widget.show();
    }

    show_edit()
    {
        // Don't show search editing if history is already open.
        if(this.dropdown_widget.shown)
            return;

        this.edit_widget.show();

        // Disable adding searches to search history while the edit dropdown is open.  Otherwise,
        // every time a tag is toggled, that combination of tags is added to search history by
        // data_source_search, which makes a mess.
        helpers.disable_adding_search_tags(true);
    }

    hide()
    {
        helpers.disable_adding_search_tags(false);

        this.dropdown_widget.hide();
        this.edit_widget.hide();
    }

    container_onmouseenter(e)
    {
        this.mouse_over_parent = true;
    }

    container_onmouseleave(e)
    {
        this.mouse_over_parent = false;
        if(this.dropdown_widget.shown && !this.input_focused && !this.mouse_over_parent)
            this.hide();
    }

    // Show the dropdown when the input is focused.  Hide it when the input is both
    // unfocused and this.container isn't being hovered.  This way, the input focus
    // can leave the input box to manipulate the dropdown without it being hidden,
    // but we don't rely on hovering to keep the dropdown open.
    input_onfocus(e)
    {
        this.input_focused = true;
        if(!this.dropdown_widget.shown && !this.edit_widget.shown)
            this.show_history();
    }

    input_onblur(e)
    {
        this.input_focused = false;
        if(this.dropdown_widget.shown && !this.input_focused && !this.mouse_over_parent)
            this.hide();
    }

    submit_search(e)
    {
        // This can be sent to either the search page search box or the one in the
        // navigation dropdown.  Figure out which one we're on.
        var search_box = e.target.closest(".search-box");
        var content = this.input_element.value.trim();
        if (content.length === 0) return
        content.startsWith("f:") ? this.start_filter(content) : this.start_search(content);
    }

    start_filter(content){
        var filter = content.substring(2);
        if (filter.length === 0) filter = "true";
        else helpers.add_recent_search_tag(content);
        helpers.set_value("search-filter", filter);
        location.reload();
    }

    start_search(tags){
        // Add this tag to the recent search list.
        helpers.add_recent_search_tag(tags);

        // If we're submitting by pressing enter on an input element, unfocus it and
        // close any widgets inside it (tag dropdowns).
        if(e.target instanceof HTMLInputElement)
        {
            e.target.blur();
            view_hidden_listener.send_viewhidden(e.target);
        }
        
        // Run the search.
        helpers.set_page_url(page_manager.singleton().get_url_for_tag_search(tags), true);
    }
}

class tag_search_dropdown_widget
{
    constructor(container)
    {
        this.dropdown_onclick = this.dropdown_onclick.bind(this);
        this.input_onkeydown = this.input_onkeydown.bind(this);
        this.input_oninput = this.input_oninput.bind(this);
        this.populate_dropdown = this.populate_dropdown.bind(this);

        this.container = container;
        this.input_element = this.container.querySelector(".search-tags");

        this.input_element.addEventListener("keydown", this.input_onkeydown);
        this.input_element.addEventListener("input", this.input_oninput);

        // Refresh the dropdown when the tag search history changes.
        window.addEventListener("recent-tag-searches-changed", this.populate_dropdown);

        // Add the dropdown widget.
        this.tag_dropdown = helpers.create_from_template(".template-tag-dropdown");
        this.tag_dropdown.addEventListener("click", this.dropdown_onclick);
        this.container.appendChild(this.tag_dropdown);

        this.current_autocomplete_results = [];

        // input-dropdown is resizable.  Save the size when the user drags it.
        this.input_dropdown = this.tag_dropdown.querySelector(".input-dropdown");
        let observer = new MutationObserver((mutations) => {
            // resize sets the width.  Use this instead of offsetWidth, since offsetWidth sometimes reads
            // as 0 here.
            settings.set("tag-dropdown-width", this.input_dropdown.style.width);
        });
        observer.observe(this.input_dropdown, { attributes: true });

        // Restore input-dropdown's width.  Force a minimum width, in case this setting is saved incorrectly.
        this.input_dropdown.style.width = settings.get("tag-dropdown-width", "400px");

        this.shown = false;
        this.tag_dropdown.hidden = true;

        // Sometimes the popup closes when searches are clicked and sometimes they're not.  Make sure
        // we always close on navigation.
        this.tag_dropdown.addEventListener("click", (e) => {
            if(e.defaultPrevented)
                return;
            let a = e.target.closest("A");
            if(a == null)
                return;

            this.input_element.blur();
            this.hide();
        });
    }

    dropdown_onclick(e)
    {
        var remove_entry = e.target.closest(".remove-history-entry");
        if(remove_entry != null)
        {
            // Clicked X to remove a tag from history.
            e.stopPropagation();
            e.preventDefault();
            var tag = e.target.closest(".entry").dataset.tag;
            helpers.remove_recent_search_tag(tag);
            return;
        }

        // Close the dropdown if the user clicks a tag (but not when clicking
        // remove-history-entry).
        if(e.target.closest(".tag"))
            this.hide();
    }

    input_onkeydown(e)
    {
        // Only handle inputs when we're open.
        if(this.tag_dropdown.hidden)
            return;

        switch(e.keyCode)
        {
        case 38: // up arrow
        case 40: // down arrow
            e.preventDefault();
            e.stopImmediatePropagation();
            this.move(e.keyCode == 40);
            break;
        }
        
    }

    input_oninput(e)
    {
        if(this.tag_dropdown.hidden)
            return;
        
        // Clear the selection on input.
        this.set_selection(null);

        // Update autocomplete when the text changes.
        this.run_autocomplete();
    }

    async show()
    {
        if(this.shown)
            return;
        this.shown = true;

        // Fill in the dropdown before displaying it.  If hide() is called before this
        // finishes this will return false, so stop.
        if(!await this.populate_dropdown())
            return;

        this.tag_dropdown.hidden = false;
    }

    hide()
    {
        if(!this.shown)
            return;
        this.shown = false;

        // If populate_dropdown is still running, cancel it.
        this.cancel_populate_dropdown();

        this.tag_dropdown.hidden = true;

        // Make sure the input isn't focused.
        this.input_element.blur();
    }

    async run_autocomplete()
    {
        // If true, this is a value change caused by keyboard navigation.  Don't run autocomplete,
        // since we don't want to change the dropdown due to navigating in it.
        if(this.navigating)
            return;
        
        var tags = this.input_element.value.trim();

        // Stop if we're already up to date.
        if(this.most_recent_search == tags)
            return;

        if(this.autocomplete_request != null)
        {
            // If an autocomplete request is already running, let it finish before we
            // start another.  This matches the behavior of Pixiv's input forms.
            console.log("Delaying search for", tags);
            return;
        }

        if(tags == "")
        {
            // Don't send requests with an empty string.  Just finish the search synchronously,
            // so we clear the autocomplete immediately.
            if(this.abort_autocomplete != null)
                this.abort_autocomplete.abort();
            this.autocomplete_request_finished("", { candidates: [] });
            return;
        }

        // Run the search.
        try {
            this.abort_autocomplete = new AbortController();
            var result = await helpers.rpc_get_request("/rpc/cps.php", {
                keyword: tags,
            }, {
                signal: this.abort_autocomplete.signal,
            });

            this.autocomplete_request_finished(tags, result);
        } catch(e) {
            console.info("Tag autocomplete aborted:", e);
        } finally {
            this.abort_autocomplete = null;
        }
    }
    
    // A tag autocomplete request finished.
    autocomplete_request_finished(tags, result)
    {
        this.most_recent_search = tags;
        this.abort_autocomplete = null;

        // Store the new results.
        this.current_autocomplete_results = result.candidates || [];

        // Refresh the dropdown with the new results.
        this.populate_dropdown();

        // If the input element's value has changed since we started this search, we
        // stalled any other autocompletion.  Start it now.
        if(tags != this.input_element.value)
        {
            console.log("Run delayed autocomplete");
            this.run_autocomplete();
        }
    }

    // tag_search is a search, like "tag -tag2".  translated_tags is a dictionary of known translations.
    create_entry(tag_search, translated_tags)
    {
        var entry = helpers.create_from_template(".template-tag-dropdown-entry");
        entry.dataset.tag = tag_search;

        let translated_tag = translated_tags[tag_search];
        if(translated_tag)
            entry.dataset.translated_tag = translated_tag;

        let tag_container = entry.querySelector(".search");
        for(let tag of helpers.split_search_tags(tag_search))
        {
            if(tag == "")
                continue;

            // Force "or" lowercase.
            if(tag.toLowerCase() == "or")
                tag = "or";

            let span = document.createElement("span");
            span.dataset.tag = tag;
            span.classList.add("word");
            if(tag == "or")
                span.classList.add("or");
            else
                span.classList.add("tag");

            // Split off - prefixes to look up the translation, then add it back.
            let prefix_and_tag = helpers.split_tag_prefixes(tag);
            let translated_tag = translated_tags[prefix_and_tag[1]];
            if(translated_tag)
                translated_tag = prefix_and_tag[0] + translated_tag;

            span.innerText = translated_tag || tag;
            if(translated_tag)
                span.dataset.translated_tag = translated_tag;

            tag_container.appendChild(span);
        }

        var url = page_manager.singleton().get_url_for_tag_search(tag_search);
        entry.href = url;
        return entry;
    }

    set_selection(idx)
    {
        // Temporarily set this.navigating to true.  This lets run_autocomplete know that
        // it shouldn't run an autocomplete request for this value change.
        this.navigating = true;
        try {
            // If there's an autocomplete request in the air, cancel it.
            if(this.abort_autocomplete != null)
                this.abort_autocomplete.abort();

            // Clear any old selection.
            var all_entries = this.tag_dropdown.querySelectorAll(".input-dropdown-list .entry");
            if(this.selected_idx != null)
                all_entries[this.selected_idx].classList.remove("selected");

            // Set the new selection.
            this.selected_idx = idx;
            if(this.selected_idx != null)
            {
                var new_entry = all_entries[this.selected_idx];
                new_entry.classList.add("selected");
                this.input_element.value = new_entry.dataset.tag;
            }
        } finally {
            this.navigating = false;
        }
    }

    // Select the next or previous entry in the dropdown.
    move(down)
    {
        var all_entries = this.tag_dropdown.querySelectorAll(".input-dropdown-list .entry");

        // Stop if there's nothing in the list.
        var total_entries = all_entries.length;
        if(total_entries == 0)
            return;

        var idx = this.selected_idx;
        if(idx == null)
            idx = down? 0:(total_entries-1);
        else
            idx += down? +1:-1;
        idx %= total_entries;

        this.set_selection(idx);
    }

    // Populate the tag dropdown.
    //
    // This is async, since IndexedDB is async.  (It shouldn't be.  It's an overcorrection.
    // Network APIs should be async, but local I/O should not be forced async.)  If another
    // call to populate_dropdown() is made before this completes or cancel_populate_dropdown
    // cancels it, return false.  If it completes, return true.
    async populate_dropdown()
    {
        // If another populate_dropdown is already running, cancel it and restart.
        this.cancel_populate_dropdown();

        // Set populate_dropdown_abort to an AbortController for this call.
        let abort_controller = this.populate_dropdown_abort = new AbortController();        
        let abort_signal = abort_controller.signal;

        var tag_searches = helpers.get_value("recent-tag-searches") || [];

        // Separate tags in each search, so we can look up translations.
        //
        var all_tags = {};
        for(let tag_search of tag_searches)
        {
            for(let tag of helpers.split_search_tags(tag_search))
            {
                tag = helpers.split_tag_prefixes(tag)[1];
                all_tags[tag] = true;
            }
        }
        all_tags = Object.keys(all_tags);
        
        let translated_tags = await tag_translations.get().get_translations(all_tags, "en");

        // Check if we were aborted while we were loading tags.
        if(abort_signal && abort_signal.aborted)
        {
            console.log("populate_dropdown_inner aborted");
            return false;
        }
        
        var list = this.tag_dropdown.querySelector(".input-dropdown-list");
        helpers.remove_elements(list);

        var autocompleted_tags = this.current_autocomplete_results;
        for(var tag of autocompleted_tags)
        {
            var entry = this.create_entry(tag.tag_name, translated_tags);
            entry.classList.add("autocomplete"); 
            list.appendChild(entry);
        }

        for(var tag of tag_searches)
        {
            var entry = this.create_entry(tag, translated_tags);
            entry.classList.add("history");
            list.appendChild(entry);
        }

        return true;
    }

    cancel_populate_dropdown()
    {
        if(this.populate_dropdown_abort == null)
            return;

        this.populate_dropdown_abort.abort();
    }
}

class tag_search_edit_widget
{
    constructor(container)
    {
        this.dropdown_onclick = this.dropdown_onclick.bind(this);
        this.populate_dropdown = this.populate_dropdown.bind(this);

        this.container = container;
        this.input_element = this.container.querySelector(".search-tags");

        // Refresh the dropdown when the tag search history changes.
        window.addEventListener("recent-tag-searches-changed", this.populate_dropdown);

        // Add the dropdown widget.
        this.tag_dropdown = helpers.create_from_template(".template-edit-search-dropdown");
        this.tag_dropdown.addEventListener("click", this.dropdown_onclick);
        this.container.appendChild(this.tag_dropdown);

        // Refresh tags if the user edits the search directly.
        this.input_element.addEventListener("input", (e) => { this.refresh_highlighted_tags(); });

        // input-dropdown is resizable.  Save the size when the user drags it.
        this.input_dropdown = this.tag_dropdown.querySelector(".input-dropdown");
        let observer = new MutationObserver((mutations) => {
            // resize sets the width.  Use this instead of offsetWidth, since offsetWidth sometimes reads
            // as 0 here.
            settings.set("search-edit-dropdown-width", this.input_dropdown.style.width);
        });
        observer.observe(this.input_dropdown, { attributes: true });

        // Restore input-dropdown's width.  Force a minimum width, in case this setting is saved incorrectly.
        this.input_dropdown.style.width = settings.get("search-edit-dropdown-width", "400px");

        this.shown = false;
        this.tag_dropdown.hidden = true;
    }

    dropdown_onclick(e)
    {
        e.preventDefault();
        e.stopImmediatePropagation();

        // Clicking tags toggles the tag in the search box.
        let tag = e.target.closest(".tag");
        if(tag == null)
            return;

        this.toggle_tag(tag.dataset.tag);

        // Control-clicking the tag probably caused its enclosing search link to be focused, which will
        // cause it to activate when enter is pressed.  Switch focus to the input box, so pressing enter
        // will submit the search.
        this.input_element.focus();
    }

    async show()
    {
        if(this.shown)
            return;
        this.shown = true;

        // Fill in the dropdown before displaying it.  If hide() is called before this
        // finishes this will return false, so stop.
        if(!await this.populate_dropdown())
            return;

        this.tag_dropdown.hidden = false;
    }

    hide()
    {
        if(!this.shown)
            return;
        this.shown = false;

        // If populate_dropdown is still running, cancel it.
        this.cancel_populate_dropdown();

        this.tag_dropdown.hidden = true;

        // Make sure the input isn't focused.
        this.input_element.blur();
    }

    // tag_search is a search, like "tag -tag2".  translated_tags is a dictionary of known translations.
    create_entry(tag_search, translated_tags)
    {
        var entry = helpers.create_from_template(".template-edit-search-dropdown-entry");
        entry.dataset.tag = tag_search;

        let translated_tag = translated_tags[tag_search];
        if(translated_tag)
            entry.dataset.translated_tag = translated_tag;

        let tag_container = entry.querySelector(".search");
        for(let tag of helpers.split_search_tags(tag_search))
        {
            if(tag == "")
                continue;

            let span = document.createElement("span");
            span.dataset.tag = tag;
            span.classList.add("word");
            if(tag != "or")
                span.classList.add("tag");

            // Split off - prefixes to look up the translation, then add it back.
            let prefix_and_tag = helpers.split_tag_prefixes(tag);
            let translated_tag = translated_tags[prefix_and_tag[1]];
            if(translated_tag)
                translated_tag = prefix_and_tag[0] + translated_tag;

            span.innerText = translated_tag || tag;
            if(translated_tag)
                span.dataset.translated_tag = translated_tag;

            tag_container.appendChild(span);
        }

        var url = page_manager.singleton().get_url_for_tag_search(tag_search);
        entry.querySelector("A.search").href = url;
        return entry;
    }

    // Populate the tag dropdown.
    //
    // This is async, since IndexedDB is async.  (It shouldn't be.  It's an overcorrection.
    // Network APIs should be async, but local I/O should not be forced async.)  If another
    // call to populate_dropdown() is made before this completes or cancel_populate_dropdown
    // cancels it, return false.  If it completes, return true.
    async populate_dropdown()
    {
        // If another populate_dropdown is already running, cancel it and restart.
        this.cancel_populate_dropdown();

        // Set populate_dropdown_abort to an AbortController for this call.
        let abort_controller = this.populate_dropdown_abort = new AbortController();        
        let abort_signal = abort_controller.signal;

        var tag_searches = helpers.get_value("recent-tag-searches") || [];

        // Individually show all tags in search history.
        var all_tags = {};
        for(let tag_search of tag_searches)
        {
            for(let tag of helpers.split_search_tags(tag_search))
            {
                tag = helpers.split_tag_prefixes(tag)[1];

                // Ignore "or".
                if(tag == "" || tag == "or")
                    continue;

                all_tags[tag] = true;
            }
        }
        all_tags = Object.keys(all_tags);
        
        let translated_tags = await tag_translations.get().get_translations(all_tags, "en");

        // Sort tags by their translation.
        all_tags.sort((lhs, rhs) => {
            if(translated_tags[lhs]) lhs = translated_tags[lhs];
            if(translated_tags[rhs]) rhs = translated_tags[rhs];
            return lhs.localeCompare(rhs);
        });

        // Check if we were aborted while we were loading tags.
        if(abort_signal && abort_signal.aborted)
        {
            console.log("populate_dropdown_inner aborted");
            return false;
        }
        
        var list = this.tag_dropdown.querySelector(".input-dropdown-list");
        helpers.remove_elements(list);

        for(var tag of all_tags)
        {
            var entry = this.create_entry(tag, translated_tags);
            list.appendChild(entry);
        }

        this.refresh_highlighted_tags();

        return true;
    }

    cancel_populate_dropdown()
    {
        if(this.populate_dropdown_abort == null)
            return;

        this.populate_dropdown_abort.abort();
    }

    refresh_highlighted_tags()
    {
        let tags = helpers.split_search_tags(this.input_element.value);
        
        var list = this.tag_dropdown.querySelector(".input-dropdown-list");
        for(let tag_entry of list.querySelectorAll("[data-tag]"))
        {
            let tag = tag_entry.dataset.tag;
            let tag_selected = tags.indexOf(tag) != -1;
            helpers.set_class(tag_entry, "highlight", tag_selected);
        }
    }

    // Add or remove tag from the tag search.  This doesn't affect -tag searches.
    toggle_tag(tag)
    {
        console.log("Toggle tag:", tag);

        let tags = helpers.split_search_tags(this.input_element.value);
        let idx = tags.indexOf(tag);
        if(idx != -1)
            tags.splice(idx, 1);
        else
            tags.push(tag);
        this.input_element.value = tags.join(" ");

        this.refresh_highlighted_tags();

        // Navigate to the edited search immediately.  Don't add these to history, since it
        // spams navigation history.
        helpers.set_page_url(page_manager.singleton().get_url_for_tag_search(this.input_element.value), false);
    }
}

