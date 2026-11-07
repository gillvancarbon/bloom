package com.habittracker.habit;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bulk data endpoints used by backup/restore. Both operations act on the whole
 * dataset and run in one service transaction.
 */
@RestController
@RequestMapping({"/api/data", "/api/v1/data"})
@CrossOrigin(origins = "http://localhost:5173")
public class DataController {

    private final DataService dataService;

    public DataController(DataService dataService) {
        this.dataService = dataService;
    }

    /** Wipe every habit and task, and restart consistency tracking from today. */
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearAll() {
        dataService.clearAll();
    }

    /** Replace the whole dataset with an exported snapshot. 400 if the payload is malformed. */
    @PostMapping("/import")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void importData(@RequestBody ImportRequest request) {
        dataService.importData(request);
    }
}
