// A basic widget base class.
class widget
{
    constructor(container)
    {
        this.container = container;

        // Let the caller finish, then refresh.
        setTimeout(() => {
            this.refresh();
        }, 0);
    }

    async refresh()
    {
    }
}

// A widget that shows info for a particular illust_id.
//
// An illust_id can be set, and we'll refresh when it changes.
class illust_widget extends widget
{
    constructor(container)
    {
        super(container);

        // Refresh when the image data changes.
        image_data.singleton().illust_modified_callbacks.register(this.refresh.bind(this));
    }

    set illust_id(value)
    {
        if(this._illust_id == value)
            return;
        this._illust_id = value;
        this.refresh();
    }
    get illust_id() { return this._illust_id; }

    get visible()
    {
        return !this.container.hidden;
    }
     
    async refresh()
    {
        // Grab the illust info.
        var illust_id = this._illust_id;
        var illust_data = null;
        if(this._illust_id != null)
            illust_data = await image_data.singleton().get_image_info(this._illust_id);

        // Stop if the ID changed while we were async.
        if(this._illust_id != illust_id)
            return;

        await this.refresh_internal(illust_data);
    }

    refresh_internal(illust_data)
    {
        throw "Not implemented";
    }
}

// Display messages in the popup widget.  This is a singleton.
class message_widget
{
    static get singleton()
    {
        if(message_widget._singleton == null)
            message_widget._singleton = new message_widget();
        return message_widget._singleton;
    }

    constructor()
    {
        this.container = document.body.querySelector(".hover-message");
        this.timer = null;
    }

    show(message)
    {
        this.clear_timer();

        this.container.querySelector(".message").innerHTML = message;

        this.container.classList.add("show");
        this.container.classList.remove("centered");
        this.timer = setTimeout(function() {
            this.container.classList.remove("show");
        }.bind(this), 1000);
    }

    clear_timer()
    {
        if(this.timer != null)
        {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    hide()
    {
        this.clear_timer();
        this.container.classList.remove("show");
    }
}

// Call a callback on any click not inside a list of nodes.
//
// This is used to close dropdown menus.
class click_outside_listener
{
    constructor(node_list, callback)
    {
        this.window_onmousedown = this.window_onmousedown.bind(this);

        this.node_list = node_list;
        this.callback = callback;

        window.addEventListener("mousedown", this.window_onmousedown, true);
    }

    // Return true if node is below any node in node_list.
    is_node_in_list(node)
    {
        for(var ancestor of this.node_list)
        {
            if(helpers.is_above(ancestor, node))
                return true;
        }
        return false;
    }
    window_onmousedown(e)
    {
        // Close the popup if anything outside the dropdown is clicked.  Don't
        // prevent the click event, so the click still happens.
        //
        // If this is a click inside the box or our button, ignore it.
        if(this.is_node_in_list(e.target))
            return;

        this.callback();
    }

    shutdown()
    {
        window.removeEventListener("mousedown", this.window_onmousedown, true);
    }
}

// Show popup menus when a button is clicked.
class dropdown_menu_opener
{
    static create_handlers(container, selectors)
    {
        for(var selector of selectors)
        {
            var item = container.querySelector(selector);
            if(item == null)
            {
                console.warn("Couldn't find", selector);
                continue;
            }
            dropdown_menu_opener.create_handler(item);
        }
    }

    // A shortcut for creating an opener for our common button/popup layout.
    static create_handler(container)
    {
        var button = container.querySelector(".menu-button");
        var box = container.querySelector(".popup-menu-box");
        if(button == null)
        {
            console.error("Couldn't find menu button for " + container);
            return;
        }
        if(box == null)
        {
            console.error("Couldn't find menu box for " + container);
            return;
        }
        new dropdown_menu_opener(button, box);
    }

    constructor(button, box)
    {
        this.box_onclick = this.box_onclick.bind(this);

        this.button = button;
        this.box = box;

        this.visible = false;

        this.button.addEventListener("click", (e) => { this.button_onclick(e); });

        // Hide popups when any containing view is hidden.
        new view_hidden_listener(this.button, (e) => {
            this.visible = false;
        });
    }

    // The viewhidden event is sent when the enclosing view is no longer visible, and
    // all menus in it should be hidden.
    onviewhidden(e)
    {
        this.visible = false;
    }

    get visible()
    {
        return !this.box.hidden;
    }

    set visible(value)
    {
        if(this.box.hidden == !value)
            return;

        this.box.hidden = !value;
        helpers.set_class(this.box, "popup-visible", value);

        if(value)
        {
            this.listener = new click_outside_listener([this.button, this.box], () => {
                this.visible = false;
            });

            if(this.close_on_click_inside)
                this.box.addEventListener("click", this.box_onclick, true);
        }
        else
        {
            if(this.listener)
            {
                this.listener.shutdown();
                this.listener = null;
            }

            this.box.removeEventListener("click", this.box_onclick, true);
        }

        // If we're inside a .top-ui-box container (the UI that sits at the top of the screen), set
        // .force-open on that element while we're open.
        let top_ui_box = this.box.closest(".top-ui-box");
        if(top_ui_box)
            helpers.set_class(top_ui_box, "force-open", value);

        // Let the widget know its visibility has changed.
        this.box.dispatchEvent(new Event(value? "popupshown":"popuphidden"));
    }

    // Return true if this popup should close when clicking inside it.  If false,
    // the menu will stay open until something else closes it.
    get close_on_click_inside()
    {
        return true;
    }

    box_onclick(e)
    {
        if(e.target.closest(".keep-menu-open"))
            return;

        this.visible = false;
    }

    // Toggle the popup when the button is clicked.
    button_onclick(e)
    {
        e.preventDefault();
        e.stopPropagation();
        this.visible = !this.visible;
    }
};

// A pointless creepy eye.  Looks away from the mouse cursor when hovering over
// the unfollow button.
class creepy_eye_widget
{
    constructor(eye)
    {
        this.onevent = this.onevent.bind(this);

        this.eye = eye;

        this.eye.addEventListener("mouseenter", this.onevent);
        this.eye.addEventListener("mouseleave", this.onevent);
        this.eye.addEventListener("mousemove", this.onevent);
        this.eye_middle = this.eye.querySelector(".middle");
    }

    onevent(e)
    {
        if(e.type == "mouseenter")
            this.hover = true;
        if(e.type == "mouseleave")
            this.hover = false;

        if(!this.hover)
        {
            this.eye_middle.style.transform = "";
            return;
        }
        var mouse = [e.pageX, e.pageY];

        var bounds = this.eye.getBoundingClientRect();
        var eye = [bounds.x + bounds.width/2, bounds.y + bounds.height/2];

        var vector_length = function(vec)
        {
            return Math.sqrt(vec[0]*vec[0] + vec[1]*vec[1]);
        }
        // Normalize to get a direction vector.
        var normalize_vector = function(vec)
        {
            var length = vector_length(vec);
            if(length < 0.0001)
                return [0,0];
            return [vec[0]/length, vec[1]/length];
        };

        var pos = [mouse[0] - eye[0], mouse[1] - eye[1]];
        pos = normalize_vector(pos);

        if(Math.abs(pos[0]) < 0.5)
        {
            var negative = pos[0] < 0;
            pos[0] = 0.5;
            if(negative)
                pos[0] *= -1;
        }
//        pos[0] = 1 - ((1-pos[0]) * (1-pos[0]));
        pos[0] *= -3;
        pos[1] *= -6;
        this.eye_middle.style.transform = "translate(" + pos[0] + "px, " + pos[1] + "px)";
    }
}

class avatar_widget
{
    // options:
    // parent: node to add ourself to (required)
    // changed_callback: called when a follow or unfollow completes
    // big: if true, show the big avatar instead of the small one
    constructor(options)
    {
        this.options = options;
        if(this.options.mode != "dropdown" && this.options.mode != "overlay")
            throw "Invalid avatar widget mode";

        this.clicked_follow = this.clicked_follow.bind(this);
        this.user_changed = this.user_changed.bind(this);

        this.root = helpers.create_from_template(".template-avatar");
        helpers.set_class(this.root, "big", this.options.big);

        image_data.singleton().user_modified_callbacks.register(this.user_changed);

        var element_author_avatar = this.root.querySelector(".avatar");

        this.img = document.createElement("img");

        // A canvas filter for the avatar.  This has no actual filters.  This is just to kill off any
        // annoying GIF animations in people's avatars.
        this.base_filter = new image_canvas_filter(this.img, element_author_avatar.querySelector("canvas.main"));

        // The actual highlight filter:
        this.highlight_filter = new image_canvas_filter(this.img, element_author_avatar.querySelector("canvas.highlight"), "brightness(150%)", (ctx, img) => {
            ctx.globalCompositeOperation = "destination-in";

            var feather = 25;
            var radius = 15;
            ctx.filter = "blur(" + feather + "px)";
            helpers.draw_round_rect(ctx, feather, feather + this.img.naturalHeight/2, this.img.naturalWidth - feather*2, this.img.naturalHeight - feather*2, radius);
            ctx.fill();
        });
        
        this.root.dataset.mode = this.options.mode;

        // Show the favorite UI when hovering over the avatar icon.
        var avatar_popup = this.root; //container.querySelector(".avatar-popup");
        if(this.options.mode == "dropdown")
        {
            avatar_popup.addEventListener("mouseover", function(e) { helpers.set_class(avatar_popup, "popup-visible", true); }.bind(this));
            avatar_popup.addEventListener("mouseout", function(e) { helpers.set_class(avatar_popup, "popup-visible", false); }.bind(this));
        }

        new creepy_eye_widget(this.root.querySelector(".unfollow-button .eye-image"));

        for(var button of avatar_popup.querySelectorAll(".follow-button.public"))
            button.addEventListener("click", this.clicked_follow.bind(this, false), false);
        for(var button of avatar_popup.querySelectorAll(".follow-button.private"))
            button.addEventListener("click", this.clicked_follow.bind(this, true), false);
        for(var button of avatar_popup.querySelectorAll(".unfollow-button"))
            button.addEventListener("click", this.clicked_follow.bind(this, true), false);
        this.element_follow_folder = avatar_popup.querySelector(".folder");

        // Follow publically when enter is pressed on the follow folder input.
        helpers.input_handler(avatar_popup.querySelector(".folder"), this.clicked_follow.bind(this, false));

        this.options.parent.appendChild(this.root);
    }

    shutdown()
    {
        image_data.singleton().user_modified_callbacks.unregister(this.user_changed);
    }

    // Refresh when the user changes.
    user_changed(user_id)
    {
        if(this.user_data == null || this.user_data.userId != user_id)
            return;

        this.set_from_user_data(this.user_data);
    }

    set_from_user_data(user_data)
    {
        // Clear the previous image.  Do this even if we're going to set it below, so we show
        // black while loading a new image rather than showing the previous image.
        this.base_filter.clear();
        this.highlight_filter.clear();

        this.user_data = user_data;
        if(this.user_data == null)
        {
            this.root.classList.add("loading");
            return;
        }
        this.root.classList.remove("loading");

        helpers.set_class(this.root, "self", user_data.userId == global_data.user_id);

        // We can't tell if we're followed privately or not, only that we're following.
        helpers.set_class(this.root, "followed", this.user_data.isFollowed);

        this.root.querySelector(".avatar-link").href = "/users/" + user_data.userId + "#ppixiv";
        this.root.querySelector(".avatar").dataset.popup = "View " + user_data.name + "'s posts";

        // Hide the popup in dropdown mode, since it covers the dropdown.
        if(this.options.mode == "dropdown")
            this.root.querySelector(".avatar").classList.remove("popup");

        // If we don't have an image because we're loaded from a source that doesn't give us them,
        // just hide the avatar image.
        var key = "imageBig";
        if(user_data[key])
            this.img.src = user_data[key];
    }
    
    async follow(follow_privately)
    {
        if(this.user_data == null)
            return;

        var tags = this.element_follow_folder.value;
        await actions.follow(this.user_data, follow_privately, tags);
    }

    async unfollow()
    {
        if(this.user_data == null)
            return;

        await actions.unfollow(this.user_data);
    }

    // Note that in some cases we'll only have the user's ID and name, so we won't be able
    // to tell if we're following.
    clicked_follow(follow_privately, e)
    {
        e.preventDefault();
        e.stopPropagation();

        if(this.user_data == null)
            return;

        if(this.user_data.isFollowed)
        {
            // Unfollow the user.
            this.unfollow();
            return;
        }

        // Follow the user.
        this.follow(follow_privately);
    }

    handle_onkeydown(e)
    {
        if(this.user_data == null)
            return;
        
        if(e.keyCode == 70) // f
        {
            // f to follow publically, F to follow privately, ^F to unfollow.
            if(this.user_data == null || e.metaKey)
                return;

            e.stopPropagation();
            e.preventDefault();

            if(e.ctrlKey)
            {
                // Remove the bookmark.
                if(!this.user_data.isFollowed)
                {
                    message_widget.singleton.show("Not following this user");
                    return;
                }

                this.unfollow();
                return;
            }

            if(this.user_data.isFollowed)
            {
                message_widget.singleton.show("Already following (^F to unfollow)");
                return;
            }
            
            this.follow(e.shiftKey);
            return;
        }
    }
};

// A list of tags, with translations in popups where available.
class tag_widget
{
    // options:
    // parent: node to add ourself to (required)
    // format_link: a function to format a tag to a URL
    constructor(options)
    {
        this.options = options;
        this.container = this.options.parent;
        this.tag_list_container = this.options.parent.appendChild(document.createElement("div"));
        this.tag_list_container.classList.add("tag-list-widget");

        // Refresh when we're opened, in case translations have been turned on or off.
        this.container.addEventListener("popupshown", (e) => {
            this.refresh();
        });
    };

    format_tag_link(tag)
    {
        if(this.options.format_link)
            return this.options.format_link(tag);

        var search_url = new URL("/tags/" + encodeURIComponent(tag) + "/artworks", window.location.href);
        search_url.hash = "#ppixiv";
        return search_url.toString();
    };

    async set(tags)
    {
        this.tags = tags;

        // Register any tag translations.  Not all sources will have this.
        tag_translations.get().add_translations(this.tags.tags);

        this.refresh();
    }

    async refresh()
    {
        if(this.tags == null)
            return;

        // Look up tag translations.
        let tag_list = [];
        for(var tag of this.tags.tags)
            tag_list.push(tag.tag);
        let translated_tags = await tag_translations.get().get_translations(tag_list, "en");
        
        // Remove any old tag list and create a new one.
        helpers.remove_elements(this.tag_list_container);

        for(var tag of tag_list)
        {
            var a = this.tag_list_container.appendChild(document.createElement("a"));
            a.classList.add("tag");
            a.classList.add("box-link");

            var popup = null;
            let translated_tag = tag;
            if(translated_tags[tag])
                translated_tag = translated_tags[tag];

            a.dataset.tag = tag;
            a.textContent = translated_tag;

            a.href = this.format_tag_link(tag);
        }
    }
};

// A helper for a simple right-click context menu.
//
// The menu opens on right click and closes when the button is released.
class popup_context_menu
{
    constructor(container)
    {
        this.onmousedown = this.onmousedown.bind(this);
        this.window_onmouseup = this.window_onmouseup.bind(this);
        this.window_onblur = this.window_onblur.bind(this);
        this.oncontextmenu = this.oncontextmenu.catch_bind(this);
        this.onmouseover = this.onmouseover.bind(this);
        this.onmouseout = this.onmouseout.bind(this);
        this.hide = this.hide.bind(this);

        this.container = container;
        this.blocking_context_menu_until_mouseup = false;
        this.blocking_context_menu_until_timer = false;

        this.container.addEventListener("mousedown", this.onmousedown);

        window.addEventListener("contextmenu", this.oncontextmenu);
        window.addEventListener("mouseup", this.window_onmouseup);

        // Create the menu.  The caller will attach event listeners for clicks.
        this.menu = helpers.create_from_template(".template-context-menu");

        // Work around glitchiness in Chrome's click behavior (if we're in Chrome).
        new fix_chrome_clicks(this.menu);

        this.menu.addEventListener("mouseover", this.onmouseover, true);
        this.menu.addEventListener("mouseout", this.onmouseout, true);

        // Whether the left and right mouse buttons are pressed:
        this.buttons_down = [false, false, false];
    }

    context_menu_enabled_for_element(element)
    {
        while(element != null && element instanceof Element)
        {
            if(element.dataset.contextMenuTarget == "off")
                return false;

            if("contextMenuTarget" in element.dataset)
                return true;

            element = element.parentNode;
        }
        return false;
    }

    // - Block the context menu when the popup menu is open (we're acting as the context menu).
    // - When the context menu is closed, keep preventing the context menu until we see a right
    // click (or loss of window focus), followed by a short delay to work around browser inconsistencies.
    oncontextmenu(e)
    {
        // If we're already visible, always block contextmenu.
/*        if(this.visible)
        {
            console.log("stop context menu (already open)");
            e.preventDefault();
            e.stopPropagation();
            return;
        }
*/
        if(this.blocking_context_menu_until_mouseup)
        {
            // console.log("stop context menu (waiting for mouseup)");
            e.preventDefault();
            e.stopPropagation();
        }

        if(this.blocking_context_menu_until_timer)
        {
            // console.log("stop context menu (waiting for timer)");
            e.preventDefault();
            e.stopPropagation();
        }

        // console.log("not preventing context menu");
    }

    onmousedown(e)
    {
        if(!this.visible && !this.context_menu_enabled_for_element(e.target))
            return;
        
        if(!this.visible && e.button != 2)
            return;

        this.buttons_down[e.button] = true;
        if(e.button != 2)
            return;

        // If invert-popup-hotkey is true, hold shift to open the popup menu.  Otherwise,
        // hold shift to suppress the popup menu so the browser context menu will open.
        //
        // Firefox doesn't cancel the context menu if shift is pressed.  This seems like a
        // well-intentioned but deeply confused attempt to let people override pages that
        // block the context menu, making it impossible for us to let you choose context
        // menu behavior and probably making it impossible for games to have sane keyboard
        // behavior at all.
        this.shift_was_pressed = e.shiftKey;
        if(navigator.userAgent.indexOf("Firefox/") == -1 && helpers.get_value("invert-popup-hotkey"))
            this.shift_was_pressed = !this.shift_was_pressed;
        if(this.shift_was_pressed)
            return;

        e.preventDefault();
        e.stopPropagation();

        if(this.toggle_mode && this.visible)
            this.hide();
        else
            this.show(e.pageX, e.pageY, e.target);

        // We're either showing or hiding the context menu on click, so block the context menu until
        // release.  It's crazy that preventDefault on mousedown doesn't prevent contextmenu and makes
        // all of this needlessly complicated.
        this.block_context_menu_until_mouseup();
    }

    // If true, RMB toggles the menu instead of displaying while held, and we'll also hide the
    // menu if the mouse moves too far away.
    get toggle_mode()
    {
        return settings.get("touchpad-mode", false);
    }

    // After mouseup, we'll move into block_context_menu_until_timer.
    block_context_menu_until_mouseup()
    {
        if(this.blocking_context_menu_until_mouseup)
            return;
        console.log("Waiting for mouseup before releasing context menu");
        this.blocking_context_menu_until_mouseup = true;
    }

    // Keep blocking briefly after mouseup.  This works around Firefox being flaky.  Otherwise,
    // mashing the RMB will cause the context menu to randomly appear (this doesn't happen in
    // Chrome).
    block_context_menu_until_timer()
    {
        console.log("Waiting for timer before releasing context menu");

        this.blocking_context_menu_until_mouseup = false;
        this.blocking_context_menu_until_timer = true;
        if(this.timer != null)
        {
            clearTimeout(this.timer);
            this.timer = null;
        }

        this.timer = setTimeout(() => {
            this.timer = null;

            console.log("Releasing context menu after timer");
            this.blocking_context_menu_until_timer = false;
        }, 50);
    }

    // Releasing the left or right mouse button hides the menu if both the left
    // and right buttons are released.  Pressing right, then left, then releasing
    // right won't close the menu until left is also released.  This prevents lost
    // inputs when quickly right-left clicking.
    window_onmouseup(e)
    {
        // If we're blocking until mouseup and this is a RMB release, switch to blocking on
        // a timer.
        if(e.button == 2 && this.blocking_context_menu_until_mouseup)
            this.block_context_menu_until_timer();

        if(!this.visible)
            return;

        this.buttons_down[e.button] = false;
        if(this.toggle_mode)
            return;

        if(!this.buttons_down[0] && !this.buttons_down[2])
        {
            // Run the hide asynchronously.  If we close it immediately and this
            // release would have triggered a click event, the click won't happen.
            setTimeout(() => {
                this.hide();
            }, 0);
        }
    }

    window_onblur(e)
    {
        this.hide();
    }

    // Return the element that should be under the cursor when the menu is opened.
    get element_to_center()
    {
        return null;
    }
    get visible()
    {
        return this.displayed_menu != null;
    }
    show(x, y, target)
    {
        this.menu.hidden = false;

        if(this.visible)
            return;

        this.displayed_menu = this.menu;
        this.container.appendChild(this.displayed_menu);

        // Disable popup UI while a context menu is open.
        document.body.classList.add("hide-ui");
        
        window.addEventListener("blur", this.window_onblur);

        // In toggle mode, close the popup if anything outside is clicked.
        if(this.toggle_mode && this.click_outside_listener == null)
        {
            this.click_outside_listener = new click_outside_listener([this.menu], () => {
                // Small hack: delay this, so if this is a right click, it doesn't close and then
                // immediately reopen the menu.
                setTimeout(this.hide, 0);
            });
        }

        var centered_element = this.element_to_center;
        if(centered_element == null)
            centered_element = this.displayed_menu;
        var pos = helpers.get_relative_pos(centered_element, this.displayed_menu);
        x -= pos[0];
        y -= pos[1];
        x -= centered_element.offsetWidth / 2;
        y -= centered_element.offsetHeight * 3 / 4;
        this.displayed_menu.style.left = x + "px";
        this.displayed_menu.style.top = y + "px";

        hide_mouse_cursor_on_idle.disable_all();
    }

    // If element is within a button that has a tooltip set, show it.
    show_tooltip_for_element(element)
    {
        if(element != null)
            element = element.closest("[data-popup]");
        
        if(this.tooltip_element == element)
            return;

        this.tooltip_element = element;
        this.refresh_tooltip();

        if(this.tooltip_observer)
        {
            this.tooltip_observer.disconnect();
            this.tooltip_observer = null;
        }

        if(this.tooltip_element == null)
            return;

        // Refresh the tooltip if the popup attribute changes while it's visible.
        this.tooltip_observer = new MutationObserver((mutations) => {
            for(var mutation of mutations) {
                if(mutation.type == "attributes")
                {
                    if(mutation.attributeName == "data-popup")
                        this.refresh_tooltip();
                }
            }
        });
        
        this.tooltip_observer.observe(this.tooltip_element, { attributes: true });
    }

    refresh_tooltip()
    {
        var element = this.tooltip_element;
        if(element != null)
            element = element.closest("[data-popup]");
        this.menu.querySelector(".tooltip-display").hidden = element == null;
        if(element != null)
            this.menu.querySelector(".tooltip-display-text").textContent = element.dataset.popup;
    }

    onmouseover(e)
    {
        this.show_tooltip_for_element(e.target);
    }

    onmouseout(e)
    {
        this.show_tooltip_for_element(e.relatedTarget);
    }

    get hide_temporarily()
    {
        return this.menu.hidden;
    }

    set hide_temporarily(value)
    {
        this.menu.hidden = value;
    }

    hide()
    {
        if(!this.visible)
            return;

        // Let menus inside the context menu know we're closing.
        view_hidden_listener.send_viewhidden(this.menu);
        
        this.displayed_menu.parentNode.removeChild(this.displayed_menu);
        this.displayed_menu = null;
        hide_mouse_cursor_on_idle.enable_all();
        this.buttons_down = [false, false, false];
        document.body.classList.remove("hide-ui");
        window.removeEventListener("blur", this.window_onblur);

        if(this.click_outside_listener)
        {
            this.click_outside_listener.shutdown();
            this.click_outside_listener = null;
        }
    }

    shutdown()
    {
        this.hide();

        // Remove any mutation observer.
        this.show_tooltip_for_element(null);

        this.container.removeEventListener("mousedown", this.onmousedown);
        this.container.removeEventListener("click", this.onclick);
        window.removeEventListener("contextmenu", this.oncontextmenu);
        window.removeEventListener("mouseup", this.window_onmouseup);
    }
}

// A popup for inputting text.
//
// This is currently special purpose for the add tag prompt.
class text_prompt
{
    constructor()
    {
        this.submit = this.submit.bind(this);
        this.close = this.close.bind(this);
        this.onkeydown = this.onkeydown.bind(this);

        this.result = new Promise((completed, cancelled) => {
            this._completed = completed;
            this._cancelled = cancelled;
        });

        this.root = helpers.create_from_template(".template-add-tag-prompt");
        document.body.appendChild(this.root);
        this.input = this.root.querySelector("input.add-tag-input");
        this.input.value = "";
        this.input.focus();

        this.root.querySelector(".close-button").addEventListener("click", this.close);
        this.root.querySelector(".submit-button").addEventListener("click", this.submit);

        this.root.addEventListener("click", (e) => {
            // Clicks that aren't inside the box close the dialog.
            if(e.target.closest(".box") != null)
                return;

            e.preventDefault();
            e.stopPropagation();
            this.close();
        });

        window.addEventListener("keydown", this.onkeydown);

        // This disables global key handling and hotkeys.
        document.body.dataset.popupOpen = "1";
    }

    onkeydown(e)
    {
        if(e.key == "Escape")
        {
            e.preventDefault();
            e.stopPropagation();

            this.close();
        }

        if(e.key == "Enter")
        {
            e.preventDefault();
            e.stopPropagation();
            this.submit();
        }
    }

    // Close the popup and call the completion callback with the result.
    submit(e)
    {
        var result = this.input.value;
        console.log("submit", result);
        this._remove();

        this._completed(result);
    }

    close()
    {
        this._remove();

        // Cancel the promise.  If we're actually submitting a result, 
        this._cancelled("Cancelled by user");
    }

    _remove()
    {
        window.removeEventListener("keydown", this.onkeydown);

        delete document.body.dataset.popupOpen;
        this.root.remove();
    }

}

// Widget for editing bookmark tags.
class bookmark_tag_list_widget extends illust_widget
{
    constructor(container)
    {
        super(container);

        this.container.hidden = true;
        this.displaying_illust_id = null;

        this.container.appendChild(helpers.create_from_template(".template-popup-bookmark-tag-dropdown"));

        this.container.addEventListener("click", this.clicked_bookmark_tag.bind(this), true);

        this.container.querySelector(".add-tag").addEventListener("click", async (e) => {
            await actions.add_new_tag(this._illust_id);
        });

        this.container.querySelector(".sync-tags").addEventListener("click", async (e) => {
            var bookmark_tags = await actions.load_recent_bookmark_tags();
            console.log("refreshed", bookmark_tags);
            helpers.set_recent_bookmark_tags(bookmark_tags);
        });

        // Close if our containing widget is closed.
        new view_hidden_listener(this.container, (e) => {
            this.visible = false;
        });

        image_data.singleton().illust_modified_callbacks.register(this.refresh.bind(this));
        settings.register_change_callback("recent-bookmark-tags", this.refresh.bind(this));
    }

    // Return an array of tags selected in the tag dropdown.
    get selected_tags()
    {
        var tag_list = [];
        var bookmark_tags = this.container;
        for(var entry of bookmark_tags.querySelectorAll(".popup-bookmark-tag-entry"))
        {
            if(!entry.classList.contains("active"))
                continue;
            tag_list.push(entry.dataset.tag);
        }
        return tag_list;
    }

    // Override setting illust_id to save tags when we're closed.  Otherwise, illust_id will already
    // be cleared when we close and we won't be able to save.
    set illust_id(value)
    {
        // If we're hiding and were previously visible, save changes.
        if(value == null)
            this.save_current_tags();

        super.illust_id = value;
        console.log("Tag list illust_id:", value);
    }
    
    get visible()
    {
        return !this.container.hidden;
    }
    
    // Why can't setters be async?
    set visible(value) { this._set_tag_dropdown_visible(value); }

    // Hide the dropdown without committing anything.  This happens if a bookmark
    // button is pressed to remove a bookmark: if we just close the dropdown normally,
    // we'd readd the bookmark.
    hide_without_sync()
    {
        this._set_tag_dropdown_visible(false, true);
    }

    async _set_tag_dropdown_visible(value, skip_save)
    {
        if(this.container.hidden == !value)
            return;

        this.container.hidden = !value;

        if(value)
        {
            // We only load existing bookmark tags when the tag list is open, so refresh.
            await this.refresh();
        }
        else
        {
            if(!skip_save)
            {
                // Save any selected tags when the dropdown is closed.
                this.save_current_tags();
            }

            // Clear the tag list when the menu closes, so it's clean on the next refresh.
            var bookmark_tags = this.container.querySelector(".tag-list");
            helpers.remove_elements(bookmark_tags);
            this.displaying_illust_id = null;
        }
    }

    async refresh_internal(illust_data)
    {
        let illust_id = illust_data? illust_data.illustId:null;

        // If we're refreshing the same illust that's already refreshed, store which tags were selected
        // before we clear the list.
        var old_selected_tags = this.displaying_illust_id == illust_id? this.selected_tags:[];

        this.displaying_illust_id = null;

        var bookmark_tags = this.container.querySelector(".tag-list");
        helpers.remove_elements(bookmark_tags);

        var bookmarked = illust_data && illust_data.bookmarkData != null;
        var public_bookmark = illust_data && illust_data.bookmarkData && !illust_data.bookmarkData.private;
        var private_bookmark = illust_data && illust_data.bookmarkData && illust_data.bookmarkData.private;

        // Make sure the dropdown is hidden if we have no image.
        if(illust_data == null)
            this.visible = false;

        if(illust_data == null || !this.visible)
            var bookmark_tags = document.querySelector(".tag-list");

        // Create a temporary entry to show loading while we load bookmark details.
        var entry = document.createElement("span");
        bookmark_tags.appendChild(entry);
        entry.innerText = "...";

        // If the tag list is open, populate bookmark details to get bookmark tags.
        // If the image isn't bookmarked this won't do anything.
        await image_data.singleton().load_bookmark_details(illust_data);

        // Remember which illustration's bookmark tags are actually loaded.
        this.displaying_illust_id = illust_id;

        // Remove elements again, in case another refresh happened while we were async
        // and to remove the loading entry.
        helpers.remove_elements(bookmark_tags);
        
        // Put tags that are set on the bookmark first in alphabetical order, followed by
        // all other tags in order of recent use.
        var active_tags = illust_data.bookmarkData? Array.from(illust_data.bookmarkData.tags):[];

        // If we're refreshing the list while it's open, make sure that any tags the user
        // selected are still in the list, even if they were removed by the refresh.  Put
        // them in active_tags, so they'll be marked as active.
        for(var tag of old_selected_tags)
        {
            if(active_tags.indexOf(tag) == -1)
                active_tags.push(tag);
        }

        var shown_tags = Array.from(active_tags); // copy
        shown_tags.sort();

        var recent_bookmark_tags = Array.from(helpers.get_recent_bookmark_tags()); // copy
        for(var tag of recent_bookmark_tags)
            if(shown_tags.indexOf(tag) == -1)
                shown_tags.push(tag);

        shown_tags.sort();
        console.log("Showing tags:", shown_tags);

        for(var i = 0; i < shown_tags.length; ++i)
        {
            var tag = shown_tags[i];
            var entry = helpers.create_from_template(".template-popup-bookmark-tag-entry");
            entry.dataset.tag = tag;
            bookmark_tags.appendChild(entry);
            entry.querySelector(".tag-name").innerText = tag;

            var active = active_tags.indexOf(tag) != -1;
            helpers.set_class(entry, "active", active);
        }
    }

    // Save the selected bookmark tags to the current illust.
    async save_current_tags()
    {
        // Store the ID and tag list we're saving, since they can change when we await.
        let illust_id = this._illust_id;
        let new_tags = this.selected_tags;
        if(illust_id == null)
            return;

        // Only save tags if we're refreshed to the current illust ID, to make sure we don't save
        // incorrectly if we're currently waiting for the async refresh.
        if(illust_id != this.displaying_illust_id)
            return;

        // Get the tags currently on the bookmark to compare.
        var illust_data = await image_data.singleton().get_image_info(illust_id);
        await image_data.singleton().load_bookmark_details(illust_data);
        var old_tags = illust_data.bookmarkData? illust_data.bookmarkData.tags:[];

        var equal = new_tags.length == old_tags.length;
        for(var tag of new_tags)
        {
            if(old_tags.indexOf(tag) == -1)
                equal = false;
        }
        // If the selected tags haven't changed, we're done.
        if(equal)
            return;
        
        // Save the tags.  If the image wasn't bookmarked, this will create a public bookmark.
        console.log("Tag list closing and tags have changed");
        console.log("Old tags:", old_tags);
        console.log("New tags:", new_tags);
        var is_bookmarked = illust_data.bookmarkData != null;

        await actions.bookmark_edit(illust_data, {
            tags: new_tags,
        });
    }

    // Toggle tags on click.  We don't save changes until we're closed.
    async clicked_bookmark_tag(e)
    {
        var a = e.target.closest(".popup-bookmark-tag-entry");
        if(a == null)
            return;

        e.preventDefault();
        e.stopPropagation();

        // Toggle this tag.  Don't actually save it immediately, so if we make multiple
        // changes we don't spam requests.
        var tag = a.dataset.tag;
        helpers.set_class(a, "active", !a.classList.contains("active"));
    }
}

// The button that shows and hides the tag list.
class toggle_bookmark_tag_list_widget extends illust_widget
{
    constructor(container, bookmark_tag_widget)
    {
        super(container);

        this.bookmark_tag_widget = bookmark_tag_widget;

        // XXX
        // this.menu.querySelector(".tag-dropdown-arrow").hidden = !value;

        this.container.addEventListener("click", (e) => {
            e.preventDefault();

            // Ignore clicks if this button isn't enabled.
            if(!this.container.classList.contains("enabled"))
                return;
            
            this.bookmark_tag_widget.visible = !this.bookmark_tag_widget.visible;
        });
    }

    async refresh_internal(illust_data)
    {
        helpers.set_class(this.container, "enabled", illust_data != null);
    }
}

class bookmark_button_widget extends illust_widget
{
    constructor(container, private_bookmark, bookmark_tag_widget)
    {
        super(container);

        this.private_bookmark = private_bookmark;
        this.bookmark_tag_widget = bookmark_tag_widget;

        this.container.addEventListener("click", this.clicked_bookmark.bind(this));

        image_data.singleton().illust_modified_callbacks.register(this.refresh.bind(this));
    }

    async refresh_internal(illust_data)
    {
        var count = this.container.querySelector(".count");
        if(count)
            count.textContent = illust_data? illust_data.bookmarkCount:"---";

        var bookmarked = illust_data && illust_data.bookmarkData != null;
        var our_bookmark_type = illust_data && illust_data.bookmarkData && illust_data.bookmarkData.private == this.private_bookmark;

        // Set up the bookmark buttons.
        helpers.set_class(this.container,  "enabled",     illust_data != null);
        helpers.set_class(this.container,  "bookmarked",  our_bookmark_type);
        helpers.set_class(this.container,  "will-delete", our_bookmark_type);
        
        // Set the tooltip.
        var type_string = this.private_bookmark? "private":"public";
        this.container.dataset.popup =
            illust_data == null? "":
            !bookmarked? (this.private_bookmark? "Bookmark privately":"Bookmark image"):
            our_bookmark_type? "Remove bookmark":
            "Change bookmark to " + type_string;
    }
    
    // Clicked one of the top-level bookmark buttons or the tag list.
    async clicked_bookmark(e)
    {
        // See if this is a click on a bookmark button.
        var a = e.target.closest(".button-bookmark");
        if(a == null)
            return;

        e.preventDefault();
        e.stopPropagation();

        // If the tag list dropdown is open, make a list of tags selected in the tag list dropdown.
        // If it's closed, leave tag_list null so we don't modify the tag list.
        var tag_list = null;
        if(this.bookmark_tag_widget && this.bookmark_tag_widget.visible)
            tag_list = this.bookmark_tag_widget.selected_tags;

        // If we have a tag list dropdown, close it before saving the bookmark.
        //
        // When the tag list bookmark closes, it'll save the bookmark with its current tags
        // if they're different, creating the bookmark if needed.  If we leave it open when
        // we save, it's possible to click the private bookmark button in the context menu,
        // then release the right mouse button to close the context menu before the bookmark
        // finishes saving.  The tag list won't know that the bookmark is already being saved
        // and will save.  This can cause private bookmarks to become public bookmarks.  Just
        // tell the tag list to close without saving, since we're committing the tag list now.
        if(this.bookmark_tag_widget)
            this.bookmark_tag_widget.hide_without_sync();

        // If the image is bookmarked and the same privacy button was clicked, remove the bookmark.
        var illust_data = await image_data.singleton().get_image_info(this._illust_id);
        if(illust_data.bookmarkData && illust_data.bookmarkData.private == this.private_bookmark)
        {
            await actions.bookmark_remove(illust_data);

            // If the current image changed while we were async, stop.
            if(this._illust_id != illust_data.illustId)
                return;
            
            // Hide the tag dropdown after unbookmarking, without saving any tags in the
            // dropdown (that would readd the bookmark).
            if(this.bookmark_tag_widget)
                this.bookmark_tag_widget.hide_without_sync();
            
            return;
        }

        // Add or edit the bookmark.
        await actions.bookmark_edit(illust_data, {
            private: this.private_bookmark,
            tags: tag_list,
        });

        // If the current image changed while we were async, stop.
        if(this._illust_id != illust_data.illustId)
            return;
    }
}

class like_button_widget extends illust_widget
{
    constructor(container, private_bookmark)
    {
        super(container);

        this.private_bookmark = private_bookmark;

        this.container.addEventListener("click", this.clicked_like.bind(this));

        image_data.singleton().illust_modified_callbacks.register(this.refresh.bind(this));
    }

    async refresh_internal(illust_data)
    {
        // Update the like button highlight and tooltip.
        this.container.querySelector(".count").textContent = illust_data? illust_data.likeCount:"---";
        helpers.set_class(this.container, "liked", illust_data && illust_data.likeData);
        helpers.set_class(this.container, "enabled", illust_data != null && !illust_data.likeData);

        this.container.dataset.popup =
            illust_data && !illust_data.likeData? "Like image":
            illust_data && illust_data.likeData? "Already liked image":"";
    }
    
    async clicked_like(e)
    {
        e.preventDefault();
        e.stopPropagation();

        var illust_data = await image_data.singleton().get_image_info(this._illust_id);
        actions.like_image(illust_data);
    }
}

