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
import { updateTicketCategoryInventoryMaxApi } from "@/apis/exhibition";

export type BatchSessionDateBounds = {
  minStart: Dayjs;
  maxEnd: Dayjs;
};

type FormValues = {
  ticket_id: string;
  sessionDateRange: [Dayjs, Dayjs];
  quantity: number;
};

type BatchSetInventoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eid: string;
  ticketOptions: { label: string; value: string }[];
  /** 可选日期：今天起至最后一场次日（闭区间） */
  dateBounds: BatchSessionDateBounds | null;
  /** 打开时默认选中的区间 */
  defaultDateRange: [Dayjs, Dayjs] | null;
  onSuccess?: () => void | Promise<void>;
};

export function BatchSetInventoryModal({
  open,
  onOpenChange,
  eid,
  ticketOptions,
  dateBounds,
  defaultDateRange,
  onSuccess,
}: BatchSetInventoryModalProps) {
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
      key={open ? "batch-inv-open" : "batch-inv-closed"}
      title="批量设置库存"
      open={open}
      onOpenChange={onOpenChange}
      initialValues={{
        ticket_id: undefined,
        sessionDateRange: defaultDateRange ?? undefined,
        quantity: undefined,
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
          await updateTicketCategoryInventoryMaxApi(eid, values.ticket_id, {
            quantity: values.quantity,
            start_session_date: start.format("YYYY-MM-DD"),
            end_session_date: end.format("YYYY-MM-DD"),
          });
          message.success("已按日期区间更新该票种场次库存上限");
          onOpenChange(false);
          await onSuccess?.();
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          message.error(msg ? `更新失败：${msg}` : "更新库存失败");
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        选择票种与场次日期闭区间后，将按接口规则对该区间内各场次做库存上限更新（与单票种「全部场次」覆盖逻辑不同）。
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
        name="quantity"
        label="库存上限"
        placeholder="请输入数量"
        fieldProps={{ min: 0, precision: 0, style: { width: "100%" } }}
        rules={[{ required: true, message: "请输入库存上限" }]}
      />
    </ModalForm>
  );
}
