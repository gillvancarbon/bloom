package com.habittracker.habit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Tiny key/value store for app-level settings (e.g. when tracking began). */
@Entity
@Table(name = "app_meta")
public class AppMeta {

    @Id
    @Column(name = "meta_key", length = 64, nullable = false)
    private String key;

    @Column(name = "meta_value", length = 64)
    private String value;

    public AppMeta() {
    }

    public AppMeta(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() {
        return key;
    }

    public void setKey(String key) {
        this.key = key;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
