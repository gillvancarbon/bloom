package com.habittracker.habit;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * A single to-do task. Kept intentionally light: a title, an optional note,
 * a category ("chores", "schoolwork", …), an optional due date, and done state.
 */
@Entity
@Table(name = "todos")
public class Todo {

    private static final String DEFAULT_CATEGORY = "personal";
    private static final String CATEGORY_PATTERN =
            "chores|schoolwork|work|personal|health|errands";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Task title is required")
    @Size(max = 120, message = "Task title must be less than 120 characters")
    @Column(nullable = false, length = 120)
    private String title;

    @Size(max = 280, message = "Note must be less than 280 characters")
    @Column(length = 280)
    private String note;

    @NotBlank(message = "Task type is required")
    @Pattern(regexp = CATEGORY_PATTERN, message = "Unknown task type")
    @Column(nullable = false, length = 20)
    private String category = DEFAULT_CATEGORY;

    @Column(name = "is_done", nullable = false)
    private boolean done = false;

    @Column(name = "due_date")
    private LocalDate dueDate;

    /**
     * Optional exact time on {@link #dueDate} after which the task is overdue.
     * With no time the task is overdue only once the date has passed.
     */
    @JsonFormat(pattern = "HH:mm")
    @Column(name = "due_time")
    private LocalTime dueTime;

    /** How much this task matters: "low", "medium" (default) or "high". */
    @Pattern(regexp = "low|medium|high", message = "Unknown priority")
    @Column(nullable = false, length = 10)
    private String importance = "medium";

    /** Archived tasks keep their details but leave the board. */
    @Column(name = "is_archived", nullable = false)
    private boolean archived = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.category == null || this.category.isBlank()) {
            this.category = DEFAULT_CATEGORY;
        }
        if (this.importance == null || this.importance.isBlank()) {
            this.importance = "medium";
        }
    }

    // Getters and setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getCategory() {
        return (category == null || category.isBlank()) ? DEFAULT_CATEGORY : category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public boolean isDone() {
        return done;
    }

    public void setDone(boolean done) {
        this.done = done;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public LocalTime getDueTime() {
        return dueTime;
    }

    public void setDueTime(LocalTime dueTime) {
        this.dueTime = dueTime;
    }

    public String getImportance() {
        return (importance == null || importance.isBlank()) ? "medium" : importance;
    }

    public void setImportance(String importance) {
        this.importance = importance;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    /** Flips the task between open and done, stamping when it was finished. */
    public void toggle() {
        this.done = !this.done;
        this.completedAt = this.done ? LocalDateTime.now() : null;
    }
}
