package com.habittracker.habit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;

/**
 * Persist a task's checklist as a JSON array in a single text column. Keeps the
 * database schema simple (no join table for a handful of steps) while the REST
 * layer still sees a normal list.
 */
@Converter
public class SubtaskListConverter implements AttributeConverter<List<Subtask>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Subtask>> TYPE = new TypeReference<>() {
    };

    @Override
    public String convertToDatabaseColumn(List<Subtask> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return null;
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public List<Subtask> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(dbData, TYPE);
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }
}
