document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');
    // Get current date dynamically (07/09/2025, 09:09 PM CEST)
    var currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set time to 00:00 for calculation
    // Calculate the start of the week containing the current date (07/07/2025 is Monday)
    var startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - (currentDate.getDay() === 0 ? 6 : currentDate.getDay()));

    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'en', // English locale
        firstDay: 1, // Set first day of week to Monday (0 = Sunday, 1 = Monday, etc.)
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        initialDate: currentDate, // Set initial date to current date
        validRange: {
            start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1) // Start from the beginning of the month
        },
        datesSet: function(info) {
            if (info.view.type === 'dayGridMonth') {
                var rows = calendarEl.querySelectorAll('.fc-daygrid-body tr');
                var currentWeekRowIndex = -1;
                var firstDayOfWeek = new Date(currentDate);
                firstDayOfWeek.setDate(currentDate.getDate() - (currentDate.getDay() === 0 ? 6 : currentDate.getDay())); // Start of current week
                var lastDayOfWeek = new Date(firstDayOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000); // End of current week

                rows.forEach((row, index) => {
                    var daysInRow = row.querySelectorAll('.fc-daygrid-day');
                    daysInRow.forEach(day => {
                        var dayDate = new Date(day.getAttribute('data-date'));
                        if (dayDate >= firstDayOfWeek && dayDate <= lastDayOfWeek) {
                            currentWeekRowIndex = index; // Find the row containing the current week
                        }
                    });
                });

                // Move the row containing the current week to the top
                if (currentWeekRowIndex > -1) {
                    var currentWeekRow = rows[currentWeekRowIndex];
                    var parent = currentWeekRow.parentNode;
                    if (currentWeekRowIndex !== 0) {
                        parent.insertBefore(currentWeekRow, parent.firstChild);
                    }
                    // Hide rows before the current week
                    rows.forEach((row, index) => {
                        var rowDate = new Date(row.querySelector('.fc-daygrid-day')?.getAttribute('data-date'));
                        if (rowDate && rowDate < firstDayOfWeek) {
                            row.style.display = 'none';
                        } else {
                            row.style.display = 'table-row';
                        }
                    });
                }
            }
        },
        events: function(fetchInfo, successCallback, failureCallback) {
            var startDate = fetchInfo.startStr;
            fetch(ccConfig.restUrl + '/events?from=' + startDate, {
                headers: { 'X-WP-Nonce': ccConfig.nonce }
            })
            .then(response => response.json())
            .then(data => {
                if (!data || data.length === 0) {
                    console.warn('No events in the displayed range.');
                    successCallback([]);
                } else {
                    successCallback(data);
                }
            })
            .catch(error => failureCallback(error));
        },
        eventContent: function(info) {
            var startTime = info.event.start ? info.event.start.toTimeString().slice(0, 5) : '';
            var endTime = info.event.end ? info.event.end.toTimeString().slice(0, 5) : '';
            var timeText = startTime && endTime ? `${startTime}-${endTime}` : startTime;
            return {
                html: `
                    <div class="fc-event-main-frame">
                        <div class="fc-event-main">
                            <div class="fc-event-title">${info.event.title}</div>
                            ${timeText ? `<div class="fc-event-time"><span class="fc-icon fc-icon-time"></span> ${timeText}</div>` : ''}
                            <div class="fc-event-info">
                                <span class="fc-icon fc-icon-user"></span> ${info.event.extendedProps.instructors}
                            </div>
                            <div class="fc-event-info">
                                <span class="fc-icon fc-icon-location"></span> ${info.event.extendedProps.location}
                            </div>
                            ${info.event.extendedProps.details ? `<div class="fc-event-info"><span class="fc-icon fc-icon-details"></span> ${info.event.extendedProps.details}</div>` : ''}
                        </div>
                    </div>
                `
            };
        },
        eventClassNames: function(arg) {
            return arg.event.extendedProps.event_type === 'fixed' ? ['event-fixed'] : ['event-temporary'];
        },
        dateClick: function(info) {
            if (isUserLoggedIn()) {
                var form = document.getElementById('event-form');
                if (form) {
                    form.style.display = 'block';
                    document.getElementById('event-id').value = '';
                    document.getElementById('event-title').value = '';
                    document.getElementById('event-start').value = info.dateStr.slice(0, 16);
                    document.getElementById('event-end').value = '';
                    document.getElementById('event-type').value = 'fixed';
                    document.getElementById('event-instructors').value = '';
                    document.getElementById('event-location').value = '';
                    document.getElementById('event-details').value = '';
                    document.getElementById('num_recurrences').value = '1';
                    document.getElementById('delete-event').style.display = 'none';
                }
            }
        },
        eventClick: function(info) {
            info.jsEvent.preventDefault();
            var form = document.getElementById('event-form');
            if (form) {
                form.style.display = 'block';
                document.getElementById('event-id').value = info.event.id;
                document.getElementById('event-title').value = info.event.title;
                document.getElementById('event-start').value = info.event.start.toISOString().slice(0, 16);
                document.getElementById('event-end').value = info.event.end ? info.event.end.toISOString().slice(0, 16) : '';
                document.getElementById('event-type').value = info.event.extendedProps.event_type;
                document.getElementById('event-instructors').value = info.event.extendedProps.instructors;
                document.getElementById('event-location').value = info.event.extendedProps.location;
                document.getElementById('event-details').value = info.event.extendedProps.details || '';
                document.getElementById('num_recurrences').value = '1';
                document.getElementById('delete-event').style.display = 'inline-block';
            }

            var popup = document.getElementById('event-popup');
            var popupContent = document.getElementById('popup-content');
            var editButton = document.getElementById('popup-edit');
            if (popup && popupContent) {
                var startTime = info.event.start ? info.event.start.toTimeString().slice(0, 5) : '';
                var endTime = info.event.end ? info.event.end.toTimeString().slice(0, 5) : '';
                var timeText = startTime && endTime ? `${startTime}-${endTime}` : startTime;
                popupContent.innerHTML = `
                    <h3>${info.event.title}</h3>
                    <p><span class="fc-icon fc-icon-time"></span> ${timeText}</p>
                    <p><span class="fc-icon fc-icon-user"></span> ${info.event.extendedProps.instructors}</p>
                    <p><span class="fc-icon fc-icon-location"></span> ${info.event.extendedProps.location}</p>
                    ${info.event.extendedProps.details ? `<p><span class="fc-icon fc-icon-details"></span> ${info.event.extendedProps.details}</p>` : ''}
                `;
                if (editButton) {
                    editButton.style.display = isUserLoggedIn() ? 'inline-block' : 'none';
                }
                popup.style.display = 'flex';

                if (isUserLoggedIn() && editButton) {
                    editButton.onclick = function() {
                        var form = document.getElementById('event-form');
                        if (form) {
                            form.style.display = 'block';
                            popup.style.display = 'none';
                        }
                    };
                }
            }
        }
    });

    calendar.render();

    function isUserLoggedIn() {
        return document.querySelector('a[href*="wp-login.php"]') === null;
    }

    var instructorSelect = document.getElementById('instructor-select');
    if (instructorSelect) {
        fetch(ccConfig.restUrl + '/events', {
            headers: { 'X-WP-Nonce': ccConfig.nonce }
        })
        .then(response => response.json())
        .then(events => {
            var instructors = new Set();
            events.forEach(event => {
                if (event.extendedProps.instructors) {
                    instructors.add(event.extendedProps.instructors);
                }
            });
            // Update instructor-select for both guest and manager
            instructorSelect.innerHTML = '<option value="">All Instructors</option>';
            instructors.forEach(instructor => {
                var option = document.createElement('option');
                option.value = instructor;
                option.textContent = instructor;
                instructorSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading instructor list:', error));
    }

    if (instructorSelect) {
        instructorSelect.addEventListener('change', function() {
            var selectedInstructor = this.value;
            calendar.setOption('events', {
                url: ccConfig.restUrl + '/events' + (selectedInstructor ? '?instructor=' + encodeURIComponent(selectedInstructor) : ''),
                headers: { 'X-WP-Nonce': ccConfig.nonce }
            });
            calendar.refetchEvents();
        });
    }

    var form = document.getElementById('event-form-data');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            var eventData = {
                id: document.getElementById('event-id').value,
                title: document.getElementById('event-title').value,
                start: document.getElementById('event-start').value,
                end: document.getElementById('event-end').value,
                event_type: document.getElementById('event-type').value,
                instructors: document.getElementById('event-instructors').value,
                location: document.getElementById('event-location').value,
                details: document.getElementById('event-details').value,
                num_recurrences: document.getElementById('num_recurrences').value
            };

            fetch(ccConfig.restUrl + '/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': ccConfig.nonce
                },
                body: JSON.stringify(eventData)
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert(data.message);
                    calendar.refetchEvents();
                    form.reset();
                    document.getElementById('event-form').style.display = 'none';
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(error => alert('Error saving event: ' + error));
        });
    }

    var popupClose = document.getElementById('popup-close');
    var popup = document.getElementById('event-popup');
    if (popupClose && popup) {
        popupClose.addEventListener('click', function() {
            popup.style.display = 'none';
        });

        popup.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
            }
        });
    }

    var cancelFormButton = document.getElementById('cancel-form');
    if (cancelFormButton) {
        cancelFormButton.addEventListener('click', function() {
            document.getElementById('event-form').style.display = 'none';
            document.getElementById('event-form-data').reset();
        });
    }

    var deleteEventButton = document.getElementById('delete-event');
    if (deleteEventButton) {
        deleteEventButton.addEventListener('click', function() {
            var eventId = document.getElementById('event-id').value;
            if (confirm('Are you sure you want to delete this event?')) {
                fetch(ccConfig.restUrl + '/events/' + eventId, {
                    method: 'DELETE',
                    headers: { 'X-WP-Nonce': ccConfig.nonce }
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert(data.message);
                        calendar.refetchEvents();
                        document.getElementById('event-form').style.display = 'none';
                        document.getElementById('event-form-data').reset();
                    } else {
                        alert('Error deleting event');
                    }
                })
                .catch(error => alert('Error deleting event: ' + error));
            }
        });
    }
});