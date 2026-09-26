package com.knowledge.platform.dto;

import com.knowledge.platform.entity.Checkin;
import lombok.Data;

import java.util.List;

/**
 * 签到页状态：今日是否已签到、连续天数、当天可获得/已获得的积分及最近签到记录。
 */
@Data
public class CheckinStatus {
    /** 今天是否已签到 */
    private boolean checkedToday;

    /**
     * 当前连续签到天数：
     * 今日已签到为今日所处连续天数；今日未签到为昨日结束的连续天数（断签后为 0）。
     */
    private int streak;

    /**
     * 当天奖励积分：
     * 今日已签到为本次实际获得积分；未签到为今日签到将获得的积分（连续第 1 天 5 分、
     * 第 3 天起 8 分、第 7 天起 10 分）。
     */
    private int todayPoints;

    /** 最近签到记录，按日期倒序 */
    private List<Checkin> recentCheckins;
}
