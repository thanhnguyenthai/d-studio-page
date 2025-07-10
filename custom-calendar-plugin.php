<?php
/*
Plugin Name: Custom Calendar Plugin
Description: Manages a calendar with events for fixed and temporary classes.
Version: 3.7.8
Author: Thanh Nguyen
*/

if (!defined('ABSPATH')) exit;

// Create database table on plugin activation
register_activation_hook(__FILE__, 'cc_create_table');

function cc_create_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'custom_calendar_events';
    $charset_collate = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        title varchar(255) NOT NULL,
        start_date DATETIME NOT NULL,
        end_date DATETIME,
        event_type varchar(50) NOT NULL,
        instructors varchar(255) NOT NULL,
        location varchar(255) NOT NULL,
        details text,
        created_by int DEFAULT NULL,
        PRIMARY KEY  (id)
    ) $charset_collate;";
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

// REST API endpoints
add_action('rest_api_init', 'cc_register_routes');

function cc_register_routes() {
    register_rest_route('custom-calendar/v1', '/events', array(
        'methods' => 'GET',
        'callback' => 'cc_get_events',
        'permission_callback' => '__return_true',
    ));

    register_rest_route('custom-calendar/v1', '/events', array(
        'methods' => 'POST',
        'callback' => 'cc_add_event',
        'permission_callback' => function() { return is_user_logged_in(); },
    ));

    register_rest_route('custom-calendar/v1', '/events/(?P<id>\d+)', array(
        'methods' => 'DELETE',
        'callback' => 'cc_delete_event',
        'permission_callback' => function() { return is_user_logged_in(); },
    ));
}

// Get events
function cc_get_events(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'custom_calendar_events';
    $instructor = $request->get_param('instructor');

    $query = "SELECT * FROM $table_name";
    if ($instructor) {
        $query .= $wpdb->prepare(" WHERE instructors LIKE %s", '%' . $wpdb->esc_like($instructor) . '%');
    }
    $query .= " ORDER BY start_date ASC";

    $events = $wpdb->get_results($query, ARRAY_A);
    $formatted_events = [];
    foreach ($events as $event) {
        $formatted_events[] = array(
            'id' => $event['id'],
            'title' => $event['title'],
            'start' => $event['start_date'],
            'end' => $event['end_date'] ?: null,
            'extendedProps' => array(
                'instructors' => $event['instructors'],
                'location' => $event['location'],
                'event_type' => $event['event_type'],
                'details' => $event['details'] ?: '',
            ),
        );
    }
    return rest_ensure_response($formatted_events);
}

// Add or update event
function cc_add_event(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'custom_calendar_events';
    $data = $request->get_json_params();

    if (empty($data['title'])) {
        return new WP_Error('invalid_data', 'Title is required', array('status' => 400));
    }

    $num_recurrences = isset($data['num_recurrences']) ? min(intval($data['num_recurrences']), 10) : 1;

    for ($i = 0; $i < $num_recurrences; $i++) {
        $start_date = date('Y-m-d H:i:s', strtotime($data['start'] . " +{$i} weeks"));
        $end_date = !empty($data['end']) ? date('Y-m-d H:i:s', strtotime($data['end'] . " +{$i} weeks")) : null;

        $event_data = array(
            'title' => sanitize_text_field($data['title']),
            'start_date' => $start_date,
            'end_date' => $end_date,
            'event_type' => sanitize_text_field($data['event_type']),
            'instructors' => sanitize_text_field($data['instructors']),
            'location' => sanitize_text_field($data['location']),
            'details' => isset($data['details']) ? sanitize_textarea_field($data['details']) : '',
            'created_by' => get_current_user_id(),
        );

        if (isset($data['id']) && $data['id'] && $i == 0) {
            $wpdb->update($table_name, $event_data, array('id' => $data['id']));
        } else {
            $wpdb->insert($table_name, $event_data);
        }
    }

    $message = isset($data['id']) && $data['id'] ? 'Event has been updated' : 'Event has been added';
    return rest_ensure_response(array('success' => true, 'message' => $message));
}

// Delete event
function cc_delete_event(WP_REST_Request $request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'custom_calendar_events';
    $id = $request->get_param('id');

    $result = $wpdb->delete($table_name, array('id' => $id));
    if ($result) {
        return rest_ensure_response(array('success' => true, 'message' => 'Event has been deleted'));
    }
    return new WP_Error('delete_failed', 'Cannot delete event', array('status' => 500));
}

// Enqueue scripts and styles
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('fullcalendar-style', plugins_url('fullcalendar/packages/core/main.min.css', __FILE__), [], '6.1.17');
    // Note: File location is /public_html/wp-content/plugins/custom-calendar-plugin/fullcalendar/packages/core/main.min.css
    if (!file_exists(WP_PLUGIN_DIR . '/custom-calendar-plugin/fullcalendar/packages/core/main.min.css')) {
        $css_content = "/* FullCalendar Core Styles v6.1.17 */\n.fc { direction: ltr; text-align: left; }\n.fc table { border-collapse: collapse; border-spacing: 0; }\n.fc .fc-daygrid-day-frame, .fc .fc-timegrid-slot { position: relative; }\n.fc .fc-daygrid-day-number, .fc .fc-timegrid-slot-label { font-size: 1em; }\n.fc .fc-button { background: #fff; border: 1px solid #ddd; padding: 0.25em 0.5em; }\n.fc .fc-button:hover { background: #f5f5f5; }\n.fc .fc-event { border: 1px solid #ddd; background: #eee; }\n";
        file_put_contents(WP_PLUGIN_DIR . '/custom-calendar-plugin/fullcalendar/packages/core/main.min.css', $css_content);
    }
    wp_enqueue_script('fullcalendar-core', plugins_url('fullcalendar/packages/core/index.global.min.js', __FILE__), [], '6.1.17', true);
    wp_enqueue_script('fullcalendar-locale-vi', plugins_url('fullcalendar/packages/core/locales/vi.global.min.js', __FILE__), ['fullcalendar-core'], '6.1.17', true);
    wp_enqueue_script('fullcalendar-daygrid', plugins_url('fullcalendar/packages/daygrid/index.global.min.js', __FILE__), ['fullcalendar-core'], '6.1.17', true);
    wp_enqueue_script('fullcalendar-timegrid', plugins_url('fullcalendar/packages/timegrid/index.global.min.js', __FILE__), ['fullcalendar-core'], '6.1.17', true);
    wp_enqueue_script('fullcalendar-interaction', plugins_url('fullcalendar/packages/interaction/index.global.min.js', __FILE__), ['fullcalendar-core'], '6.1.17', true);
    wp_enqueue_script('custom-calendar-script', plugins_url('calendar.js', __FILE__), ['fullcalendar-core', 'jquery'], '3.7.8', true);
    wp_localize_script('custom-calendar-script', 'ccConfig', [
        'restUrl' => rest_url('custom-calendar/v1'),
        'nonce' => wp_create_nonce('wp_rest'),
    ]);
    wp_enqueue_style('custom-calendar-style', plugins_url('calendar.css', __FILE__), [], '3.7.8');
});

// Shortcode to display calendar
add_shortcode('custom_calendar', function () {
    ob_start();
    ?>
    <div id="instructor-filter">
        <select id="instructor-select">
            <option value="">All Instructors</option>
        </select>
    </div>
    <div id="calendar"></div>
    <div id="event-popup" style="display: none;">
        <div id="popup-content"></div>
        <div class="popup-buttons">
            <button id="popup-edit" style="display: none;">Edit</button>
            <button id="popup-close">Close</button>
        </div>
    </div>
    <?php if (is_user_logged_in()): ?>
        <div id="event-form" style="margin-top: 20px;">
            <h3 style="text-align: center;">Add/Edit Event</h3>
            <form id="event-form-data">
                <input type="hidden" id="event-id">
                <label>Title: <input type="text" id="event-title" required></label><br>
                <label>Start Date: <input type="datetime-local" id="event-start" required></label><br>
                <label>End Date: <input type="datetime-local" id="event-end"></label><br>
                <label>Type: 
                    <select id="event-type" required>
                        <option value="fixed">Fixed Class</option>
                        <option value="temporary">Temporary Class</option>
                    </select>
                </label><br>
                <label>Instructors: <input type="text" id="event-instructors" placeholder="Example: John Doe, Jane Smith" required></label><br>
                <label>Location: <input type="text" id="event-location" placeholder="Example: Room A"></label><br>
                <label>Details: <textarea id="event-details" placeholder="Additional information (class description, notes,...)"></textarea></label><br>
                <label>Number of Recurrences (max 10): <input type="number" id="num_recurrences" min="1" max="10" value="1"></label><br>
                <button type="submit">Save Event</button>
                <button type="button" id="cancel-form">Cancel</button>
                <button type="button" id="delete-event" style="display: none; background: #ff4444;">Delete Event</button>
            </form>
            <p style="text-align: center;"><a href="<?php echo wp_logout_url(get_permalink()); ?>">Logout</a></p>
        </div>
    <?php else: ?>
        <div style="margin-top: 10px; text-align: center;">
            <a href="<?php echo wp_login_url(get_permalink()); ?>">Log in to manage calendar</a>
        </div>
    <?php endif; ?>
    <?php
    return ob_get_clean();
});