import { useState, useEffect, useRef } from 'react'
import {
  Card,
  Typography,
  Button,
  message,
  Statistic,
  Row,
  Col,
  Tag,
  Spin,
  Empty,
  Progress,
} from 'antd'
import {
  CheckCircleOutlined,
  TrophyOutlined,
  CalendarOutlined,
  FireOutlined,
} from '@ant-design/icons'
import { pointsApi } from '../api/points'
import type { PointsAccount, CheckinStatus } from '../types'
import dayjs from 'dayjs'

const { Title, Text } = Typography

// 奖励阶梯：连续第 1-2 天 5 分，第 3-6 天 8 分，第 7 天起 10 分
const REWARD_RULES = [
  { from: 1, to: 2, points: 5 },
  { from: 3, to: 6, points: 8 },
  { from: 7, to: Infinity, points: 10 },
]

function Checkin() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [account, setAccount] = useState<PointsAccount | null>(null)
  const [status, setStatus] = useState<CheckinStatus | null>(null)
  // 防止同一次点击/连点触发重复请求
  const submittingRef = useRef(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [accountRes, statusRes] = await Promise.all([
        pointsApi.getBalance(),
        pointsApi.getCheckinStatus(),
      ])
      setAccount(accountRes.data?.data ?? accountRes.data)
      setStatus(statusRes.data?.data ?? statusRes.data)
    } catch (error) {
      console.error('Failed to load checkin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckin = async () => {
    if (status?.checkedToday || submittingRef.current) {
      return
    }
    submittingRef.current = true
    setChecking(true)
    try {
      const res = await pointsApi.checkin()
      const nextStatus: CheckinStatus = res.data?.data ?? res.data
      setStatus(nextStatus)
      if (res.data?.message) {
        message.success(res.data.message)
      }
      loadData()
    } catch (error) {
      // 拦截器已统一提示；刷新状态以纠正界面
      loadData()
    } finally {
      setChecking(false)
      submittingRef.current = false
    }
  }

  const checkedToday = status?.checkedToday ?? false
  const streak = status?.streak ?? 0
  const todayPoints = status?.todayPoints ?? 5
  // 今日签到完成后所处的连续天数（用于高亮今日所在奖励档）
  const effectiveStreak = checkedToday ? streak : streak + 1

  // 距下一奖励档还需签到的天数（今天签完之后还差几天）
  let daysToNextTier = 0
  let nextTierPoints = 0
  if (effectiveStreak < 3) {
    daysToNextTier = 3 - effectiveStreak
    nextTierPoints = 8
  } else if (effectiveStreak < 7) {
    daysToNextTier = 7 - effectiveStreak
    nextTierPoints = 10
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Spin spinning={loading}>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={2}>每日签到</Title>
            <div style={{ fontSize: 64, margin: '16px 0' }}>
              {checkedToday ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : streak > 0 ? (
                <FireOutlined style={{ color: '#fa541c' }} />
              ) : (
                <CalendarOutlined style={{ color: '#1890ff' }} />
              )}
            </div>

            {/* 连续天数 + 当天奖励 */}
            <Row gutter={16} justify="center" style={{ marginBottom: 20 }}>
              <Col>
                <Statistic
                  title="连续签到"
                  value={streak}
                  suffix="天"
                  valueStyle={{ color: '#fa541c', fontSize: 32 }}
                />
              </Col>
              <Col>
                <Statistic
                  title={checkedToday ? '今日获得' : '今日奖励'}
                  value={todayPoints}
                  suffix="积分"
                  valueStyle={{ color: '#faad14', fontSize: 32 }}
                />
              </Col>
            </Row>

            {/* 奖励阶梯说明 */}
            <div style={{ marginBottom: 12 }}>
              {REWARD_RULES.map((rule) => {
                const active =
                  effectiveStreak >= rule.from && effectiveStreak <= rule.to
                return (
                  <Tag
                    key={rule.points}
                    color={active ? 'orange' : 'default'}
                    style={{ fontSize: 14, padding: '4px 12px', margin: 4 }}
                  >
                    {rule.to === Infinity
                      ? `第${rule.from}天起 ${rule.points}分`
                      : `第${rule.from}-${rule.to}天 ${rule.points}分`}
                  </Tag>
                )
              })}
            </div>

            {/* 距满勤 7 天的进度 */}
            <div style={{ maxWidth: 360, margin: '0 auto 8px' }}>
              <Progress
                percent={Math.min(100, Math.round((effectiveStreak / 7) * 100))}
                size="small"
                strokeColor="#fa8c16"
                format={() => (effectiveStreak >= 7 ? '已满勤' : `${Math.min(effectiveStreak, 7)}/7 天`)}
              />
            </div>

            <div style={{ marginBottom: 16, minHeight: 20 }}>
              {daysToNextTier > 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {checkedToday ? '' : '今日签到可得 ' + todayPoints + ' 分，'}
                  再连续签到 {daysToNextTier} 天可升级到 {nextTierPoints} 分/天
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {effectiveStreak >= 7
                    ? '已达成最高奖励，保持连续签到每天 10 分'
                    : '签到即可获得积分，连续签到奖励更多，断签将从第 1 天重新计算'}
                </Text>
              )}
            </div>

            <Button
              type="primary"
              size="large"
              onClick={handleCheckin}
              loading={checking}
              disabled={checkedToday}
              style={{ minWidth: 200, height: 48, fontSize: 18 }}
            >
              {checkedToday ? '今日已签到' : '立即签到'}
            </Button>
          </div>
        </Card>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card>
              <Statistic
                title="当前积分"
                value={account?.balance || 0}
                prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="累计获得"
                value={account?.totalEarned || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Card>
          </Col>
        </Row>

        <Card title="最近签到记录">
          {status?.recentCheckins && status.recentCheckins.length > 0 ? (
            status.recentCheckins.map((record) => (
              <div
                key={record.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500 }}>
                    <CalendarOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                    {dayjs(record.date).format('YYYY-MM-DD')}
                    <Tag color="orange" style={{ marginLeft: 8 }}>
                      连续 {record.streak ?? 1} 天
                    </Tag>
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                    {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </div>
                <span style={{ fontWeight: 600, color: '#52c41a' }}>
                  +{record.points ?? 5} 积分
                </span>
              </div>
            ))
          ) : (
            <Empty description="暂无签到记录，今天是第一天，快来签到吧~" />
          )}
        </Card>
      </Spin>
    </div>
  )
}

export default Checkin
