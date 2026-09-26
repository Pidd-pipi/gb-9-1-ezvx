package com.knowledge.platform.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Document(collection = "checkins")
@CompoundIndex(name = "userId_date_idx", def = "{'userId': 1, 'date': 1}", unique = true)
public class Checkin {
    @Id
    private String id;

    private String userId;

    private LocalDate date;

    /**
     * 连续签到天数：本次签到完成后所处的连续天数。
     * 断签后次日签到从 1 重新开始。
     */
    private Integer streak;

    /**
     * 本次签到实际发放的积分，按签到时的连续天数依据奖励规则计算。
     */
    private Integer points;

    private LocalDateTime createdAt;
}
