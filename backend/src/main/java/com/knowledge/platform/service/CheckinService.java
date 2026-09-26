package com.knowledge.platform.service;

import com.knowledge.platform.dto.ApiResponse;
import com.knowledge.platform.dto.CheckinStatus;
import com.knowledge.platform.entity.Checkin;
import com.knowledge.platform.repository.CheckinRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class CheckinService {

    private static final Logger log = LoggerFactory.getLogger(CheckinService.class);

    /** 连续签到满 3 天起的每日奖励。 */
    private static final int STREAK_THRESHOLD_MEDIUM = 3;
    /** 连续签到满 7 天起的每日奖励。 */
    private static final int STREAK_THRESHOLD_HIGH = 7;
    private static final int POINTS_BASE = 5;
    private static final int POINTS_MEDIUM = 8;
    private static final int POINTS_HIGH = 10;

    @Autowired
    private CheckinRepository checkinRepository;

    @Autowired
    private PointsService pointsService;

    /**
     * 根据连续签到天数计算当日奖励积分：
     * 第 1-2 天 5 分，第 3-6 天 8 分，第 7 天起 10 分。
     */
    public static int pointsForStreak(int streak) {
        if (streak >= STREAK_THRESHOLD_HIGH) {
            return POINTS_HIGH;
        }
        if (streak >= STREAK_THRESHOLD_MEDIUM) {
            return POINTS_MEDIUM;
        }
        return POINTS_BASE;
    }

    /**
     * 执行签到。
     *
     * 同一账号一天只能签到一次：依靠 (userId, date) 唯一索引兜底，
     * 即使重复请求或同时连点两次，也只会成功插入一条记录、发放一次积分。
     * 不使用多文档事务（当前部署为单节点 MongoDB）。
     */
    public ApiResponse<CheckinStatus> checkin(String userId) {
        LocalDate today = LocalDate.now();

        Optional<Checkin> existing = checkinRepository.findByUserIdAndDate(userId, today);
        if (existing.isPresent()) {
            // 同一账号当天重复签到，幂等返回，不再重复发放积分
            return ApiResponse.success("今天已经签到过了", buildStatus(existing.get()));
        }

        Checkin checkin = new Checkin();
        checkin.setUserId(userId);
        checkin.setDate(today);
        checkin.setCreatedAt(LocalDateTime.now());
        checkin.setStreak(calculateStreak(userId, today));
        checkin.setPoints(pointsForStreak(checkin.getStreak()));

        try {
            // 先落库签到记录：唯一索引保证并发双击时只有一个请求能插入成功
            checkin = checkinRepository.save(checkin);
        } catch (DuplicateKeyException e) {
            // 并发情况下另一个请求已经完成签到，直接返回已有记录，不重复加分
            log.debug("并发签到冲突，用户 {} 今日已签到", userId);
            return checkinRepository.findByUserIdAndDate(userId, today)
                    .map(saved -> ApiResponse.success("今天已经签到过了", buildStatus(saved)))
                    .orElseGet(() -> ApiResponse.success("今天已经签到过了", buildStatus(checkin)));
        }

        pointsService.earnPoints(userId, checkin.getPoints(),
                "每日签到（连续" + checkin.getStreak() + "天）");

        return ApiResponse.success(
                "签到成功，连续" + checkin.getStreak() + "天，+" + checkin.getPoints() + "积分",
                buildStatus(checkin));
    }

    /**
     * 查询签到状态：今日是否已签、当前连续天数、当天奖励、最近记录。
     */
    public CheckinStatus getStatus(String userId) {
        LocalDate today = LocalDate.now();
        Optional<Checkin> todayCheckin = checkinRepository.findByUserIdAndDate(userId, today);
        return todayCheckin
                .map(this::buildStatus)
                .orElseGet(() -> {
                    CheckinStatus status = new CheckinStatus();
                    status.setCheckedToday(false);
                    // 还没签到：连续天数延续到昨日，今日若签到会得到的天数用于计算预览奖励
                    int nextStreak = calculateStreak(userId, today);
                    status.setStreak(streakUntilYesterday(userId, today));
                    status.setTodayPoints(pointsForStreak(nextStreak));
                    status.setRecentCheckins(checkinRepository.findTop7ByUserIdOrderByDateDesc(userId));
                    return status;
                });
    }

    /**
     * 计算在 {@code today} 签到后所处的连续天数。
     * 上一条记录为昨天则 +1，否则（断签或首次签到）从 1 重新开始。
     */
    private int calculateStreak(String userId, LocalDate today) {
        Checkin last = checkinRepository.findFirstByUserIdOrderByDateDesc(userId).orElse(null);
        if (last == null || last.getDate() == null) {
            return 1;
        }
        if (last.getDate().equals(today.minusDays(1))) {
            int lastStreak = last.getStreak() != null ? last.getStreak() : 0;
            return lastStreak + 1;
        }
        // 昨天没有签到记录（断签），从第 1 天重新计算
        return 1;
    }

    /**
     * 未签到时展示到昨日为止的连续天数；昨天未签则为 0。
     */
    private int streakUntilYesterday(String userId, LocalDate today) {
        Checkin last = checkinRepository.findFirstByUserIdOrderByDateDesc(userId).orElse(null);
        if (last != null && last.getDate() != null && last.getDate().equals(today.minusDays(1))) {
            return last.getStreak() != null ? last.getStreak() : 0;
        }
        return 0;
    }

    private CheckinStatus buildStatus(Checkin todayCheckin) {
        CheckinStatus status = new CheckinStatus();
        status.setCheckedToday(true);
        status.setStreak(todayCheckin.getStreak() != null ? todayCheckin.getStreak() : 1);
        status.setTodayPoints(todayCheckin.getPoints() != null
                ? todayCheckin.getPoints()
                : pointsForStreak(status.getStreak()));
        List<Checkin> recent = checkinRepository.findTop7ByUserIdOrderByDateDesc(todayCheckin.getUserId());
        status.setRecentCheckins(recent);
        return status;
    }
}
