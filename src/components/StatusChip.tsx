import { Chip, ChipProps, Stack, Tooltip } from "@mui/material";
import BlockRounded from "@mui/icons-material/BlockRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import PlaylistAddCheckRounded from "@mui/icons-material/PlaylistAddCheckRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import SearchOffRounded from "@mui/icons-material/SearchOffRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import { ANNEX_INFO, AnnexRef, Verdict } from "../lib/cosing";

export const VERDICT_META: Record<
  Verdict,
  { label: string; hint: string; color: ChipProps["color"]; icon: JSX.Element }
> = {
  prohibited: {
    label: "Bị cấm",
    hint: "Nằm trong Annex II – không được dùng trong mỹ phẩm tại EU",
    color: "error",
    icon: <BlockRounded />,
  },
  restricted: {
    label: "Hạn chế",
    hint: "Nằm trong Annex III – chỉ dùng với nồng độ/điều kiện quy định",
    color: "warning",
    icon: <WarningAmberRounded />,
  },
  listed: {
    label: "Có điều kiện",
    hint: "Annex IV/V/VI – màu, chất bảo quản hoặc lọc UV được phép với giới hạn",
    color: "info",
    icon: <PlaylistAddCheckRounded />,
  },
  clear: {
    label: "Không hạn chế",
    hint: "Có trong CosIng, không thuộc Annex nào",
    color: "success",
    icon: <CheckCircleRounded />,
  },
  review: {
    label: "Cần xem lại",
    hint: "Không khớp chính xác – có các mục gần giống, hãy chọn đúng mục",
    color: "secondary",
    icon: <HelpOutlineRounded />,
  },
  notfound: {
    label: "Không tìm thấy",
    hint: "Không có mục nào trong CosIng",
    color: "default",
    icon: <SearchOffRounded />,
  },
  error: {
    label: "Lỗi tra cứu",
    hint: "Không gọi được CosIng – bấm thử lại",
    color: "error",
    icon: <ErrorOutlineRounded />,
  },
};

export function StatusChip({
  verdict,
  size = "small",
  variant,
}: {
  verdict: Verdict;
  size?: ChipProps["size"];
  variant?: ChipProps["variant"];
}) {
  const m = VERDICT_META[verdict];
  return (
    <Tooltip title={m.hint} arrow>
      <Chip
        size={size}
        color={m.color}
        icon={m.icon}
        label={m.label}
        variant={variant ?? (verdict === "clear" || verdict === "notfound" ? "outlined" : "filled")}
      />
    </Tooltip>
  );
}

const ANNEX_COLOR: Record<string, ChipProps["color"]> = {
  II: "error",
  III: "warning",
  IV: "info",
  V: "info",
  VI: "info",
};

export function AnnexChips({ refs }: { refs: AnnexRef[] }) {
  if (!refs.length) return null;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {refs.map((a) => (
        <Tooltip key={`${a.annex}/${a.ref}`} title={ANNEX_INFO[a.annex]?.label ?? ""} arrow>
          <Chip
            size="small"
            variant="outlined"
            color={ANNEX_COLOR[a.annex] ?? "default"}
            label={a.ref ? `${a.annex}/${a.ref}` : `Annex ${a.annex}`}
            sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}
