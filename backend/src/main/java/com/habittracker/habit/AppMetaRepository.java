package com.habittracker.habit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AppMetaRepository extends JpaRepository<AppMeta, String> {
}
