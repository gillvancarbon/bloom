package com.habittracker.habit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
@Transactional
public class CalendarService {

    static final String HISTORY_START_KEY = "history.start";

    private final AppMetaRepository appMetaRepository;

    public CalendarService(AppMetaRepository appMetaRepository) {
        this.appMetaRepository = appMetaRepository;
    }

    /**
     * The day consistency tracking began. Created on first read, so days before
     * this are shown as "no data" rather than as days nothing was done.
     */
    public String getHistoryStart() {
        return appMetaRepository.findById(HISTORY_START_KEY)
                .map(AppMeta::getValue)
                .orElseGet(() -> {
                    String today = LocalDate.now().toString();
                    appMetaRepository.save(new AppMeta(HISTORY_START_KEY, today));
                    return today;
                });
    }
}
