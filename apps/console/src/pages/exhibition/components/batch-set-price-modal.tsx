import { useMemo, useState } from "react";
import { Typography, message } from "antd";
import type { RangePickerProps } from "antd/es/date-picker";
import {
  ModalForm,
  ProFormDateRangePicker,
  ProFormDigit,
  ProFormSelect,
} from "@ant-design/pro-components";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { updateTicketCalendarPriceApi } from "@/apis/exhibition";
import type { BatchSessionDateBounds } from "./batch-set-inventory-modal";

type FormValues = {
  ticket_id: string;
  sessionDateRange: [Dayjs, Dayjs];
  /** 元，提交时转分 */
  price_yuan: number;
};

type BatchSetPriceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eid: string;
  ticketOptions: { label: string; value: string }[];
  dateBounds: BatchSessionDateBounds | null;
  defaultDateRange: [Dayjs, Dayjs] | null;
  onSuccess?: () => void | Promise<void>;
};

export function BatchSetPriceModal({
  open,
  onOpenChange,
  eid,
  ticketOptions,
  dateBounds,
  defaultDateRange,
  onSuccess,
}: BatchSetPriceModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const disabledDate = useMemo<
    NonNullable<RangePickerProps["disabledDate"]>
  >(() => {
    return (current) => {
      if (!dateBounds || !current) return false;
      const { minStart, maxEnd } = dateBounds;
      return (
        current.isBefore(minStart, "day") || current.isAfter(maxEnd, "day")
      );
    };
  }, [dateBounds]);

  return (
    <ModalForm<FormValues>
      key={open ? "batch-price-open" : "batch-price-closed"}
      title="批量设置价格"
      open={open}
      onOpenChange={onOpenChange}
      initialValues={{
        ticket_id: undefined,
        sessionDateRange: defaultDateRange ?? undefined,
        price_yuan: undefined,
      }}
      modalProps={{
        destroyOnClose: true,
        maskClosable: false,
      }}
      submitter={{
        searchConfig: {
          submitText: submitting ? "提交中…" : "确定",
        },
        resetButtonProps: { children: "取消" },
      }}
      width={520}
      layout="vertical"
      onFinish={async (values) => {
        if (!eid) return false;
        const raw = values.sessionDateRange;
        const start = dayjs(raw?.[0]);
        const end = dayjs(raw?.[1]);
        if (!start.isValid() || !end.isValid()) {
          message.warning("请选择有效的日期范围");
          return false;
        }
        try {
          setSubmitting(true);
          await updateTicketCalendarPriceApi(eid, values.ticket_id, {
            price: Math.round(values.price_yuan * 100),
            start_session_date: start.format("YYYY-MM-DD"),
            end_session_date: end.format("YYYY-MM-DD"),
          });
          message.success("已按日期区间更新该票种场次价格");
          onOpenChange(false);
          await onSuccess?.();
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          message.error(msg ? `更新失败：${msg}` : "更新价格失败");
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        对所选票种在闭区间内的各场次设置独立场次价格（单位：元，将按分提交至服务端）。
      </Typography.Paragraph>
      <ProFormSelect
        name="ticket_id"
        label="票种"
        placeholder="请选择票种"
        options={ticketOptions}
        rules={[{ required: true, message: "请选择票种" }]}
        fieldProps={{ showSearch: true, optionFilterProp: "label" }}
      />
      <ProFormDateRangePicker
        name="sessionDateRange"
        label="场次日期"
        placeholder={["开始日期", "结束日期"]}
        fieldProps={{
          format: "YYYY-MM-DD",
          style: { width: "100%" },
          disabledDate,
        }}
        rules={[{ required: true, message: "请选择场次日期范围" }]}
      />
      <ProFormDigit
        name="price_yuan"
        label="场次价格（元）"
        placeholder="0"
        fieldProps={{ min: 0, precision: 2, style: { width: "100%" } }}
        rules={[{ required: true, message: "请输入场次价格" }]}
      />
    </ModalForm>
  );
}
