package com.habittracker.habit;

import java.util.Objects;

/**
 * One step in a task's checklist. Stored inline with its task as JSON, so it
 * has no table of its own — the checklist is small and always read as a whole.
 */
public class Subtask {

    private String id;
    private String title;
    private boolean done;

    public Subtask() {
    }

    public Subtask(String id, String title, boolean done) {
        this.id = id;
        this.title = title;
        this.done = done;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public boolean isDone() {
        return done;
    }

    public void setDone(boolean done) {
        this.done = done;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Subtask other)) return false;
        return done == other.done
                && Objects.equals(id, other.id)
                && Objects.equals(title, other.title);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, title, done);
    }
}
