package com.habittracker.habit;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping({"/api/calendar", "/api/v1/calendar"})
@CrossOrigin(origins = "http://localhost:5173")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    /** The day tracking began; the frontend colours each day from the habits. */
    @GetMapping
    public Map<String, String> getCalendar() {
        return Map.of("historyStart", calendarService.getHistoryStart());
    }
}
