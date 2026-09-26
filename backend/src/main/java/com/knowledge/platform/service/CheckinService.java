package com.knowledge.platform.service;

import com.knowledge.platform.dto.ApiResponse;
import com.knowledge.platform.dto.CheckinStatus;
import com.knowledge.platform.entity.Checkin;
import com.knowledge.platform.repository.CheckinRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class CheckinService {

    private static final int RECENT_LIMIT = 7;

    @Autowired
    private CheckinRepository checkinRepository;

    @Autowired
    private PointsService pointsService;

    /**
     * 每日签到。
     *
     * 连续奖励规则：连续第 1~2 天 5 分，连续第 3~6 天 8 分，连续第 7 天起 10 分；
     * 断签后下一日签到视为第 1 天重新计算。
     *
     * 同一账号当天重复签到（含几乎同时点两次）只计一次：先查已有记录，
     * 插入时再依赖 (userId, date) 唯一索引兜底并发，抢到唯一记录的那次才发放积分。
     */
    public ApiResponse<Checkin> checkin(String userId) {
        LocalDate today = LocalDate.now();

        Optional<Checkin> existing = checkinRepository.findByUserIdAndDate(userId, today);
        if (existing.isPresent()) {
            Checkin checkin = existing.get();
            return ApiResponse.error("今天已经签到过了，本次只计一次", checkin);
        }

        int streak = resolveStreak(userId, today);
        int points = rewardForStreak(streak);

        Checkin checkin = new Checkin();
        checkin.setUserId(userId);
        checkin.setDate(today);
        checkin.setStreak(streak);
        checkin.setPoints(points);
        checkin.setCreatedAt(LocalDateTime.now());

        try {
            checkin = checkinRepository.save(checkin);
        } catch (DuplicateKeyException e) {
            // 并发的另一次签到已先写入唯一记录，本次不重复计分
            Checkin winner = checkinRepository.findByUserIdAndDate(userId, today).orElseThrow();
            return ApiResponse.error("今天已经签到过了，本次只计一次", winner);
        }

        pointsService.earnPoints(userId, points, "每日签到（连续第" + streak + "天）");

        return ApiResponse.success("签到成功，连续第" + streak + "天，+" + points + "积分", checkin);
    }

    /**
     * 签到页状态：连续天数、当天奖励、最近记录。
     */
    public CheckinStatus getStatus(String userId) {
        LocalDate today = LocalDate.now();
        List<Checkin> recent = checkinRepository.findTop10ByUserIdOrderByDateDesc(userId);
        if (recent.size() > RECENT_LIMIT) {
            recent = recent.subList(0, RECENT_LIMIT);
        }

        CheckinStatus status = new CheckinStatus();
        status.setRecentCheckins(recent);

        Checkin todayCheckin = recent.stream()
                .filter(c -> today.equals(c.getDate()))
                .findFirst()
                .orElse(null);
        if (todayCheckin != null) {
            status.setCheckedToday(true);
            status.setStreak(streakOrOne(todayCheckin));
            status.setTodayPoints(pointsOrZero(todayCheckin));
            return status;
        }

        status.setCheckedToday(false);
        Checkin yesterdayCheckin = recent.stream()
                .filter(c -> today.minusDays(1).equals(c.getDate()))
                .findFirst()
                .orElse(null);
        // 昨日有签到则延续连续天数（今日签到达成 streak+1），否则已断签，今日从第 1 天开始
        int tomorrowStreak = yesterdayCheckin != null ? streakOrOne(yesterdayCheckin) + 1 : 1;
        status.setStreak(yesterdayCheckin != null ? streakOrOne(yesterdayCheckin) : 0);
        status.setTodayPoints(rewardForStreak(tomorrowStreak));
        return status;
    }

    public boolean hasCheckedInToday(String userId) {
        return checkinRepository.existsByUserIdAndDate(userId, LocalDate.now());
    }

    /**
     * 计算今日签到所处的连续天数：昨天有签到则 +1，否则（含从未签到、断签）从 1 开始。
     */
    private int resolveStreak(String userId, LocalDate today) {
        return checkinRepository.findByUserIdAndDate(userId, today.minusDays(1))
                .map(c -> streakOrOne(c) + 1)
                .orElse(1);
    }

    /**
     * 连续第 1 天 5 分，连续第 3 天起 8 分，连续第 7 天起 10 分。
     */
    public static int rewardForStreak(int streak) {
        if (streak >= 7) {
            return 10;
        }
        if (streak >= 3) {
            return 8;
        }
        return 5;
    }

    /** 兼容规则上线前没有 streak 字段的历史签到记录 */
    private static int streakOrOne(Checkin checkin) {
        return checkin.getStreak() != null ? checkin.getStreak() : 1;
    }

    /** 兼容规则上线前没有 points 字段的历史签到记录 */
    private static int pointsOrZero(Checkin checkin) {
        return checkin.getPoints() != null ? checkin.getPoints() : 0;
    }
}
