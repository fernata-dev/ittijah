import { directionalIcons } from "../src/rules/directional-icons.js";
import type { Rule } from "../src/types.js";
import { TAILWIND, testRule } from "./rule-tester.js";

const rule = directionalIcons as unknown as Rule;
const lucide =
  'import { ChevronRight, ArrowLeft, ArrowUpRight, ArrowLeftRight, ChevronDown } from "lucide-react";\n';

testRule(rule, {
  valid: [
    {
      name: "rtl: variant flips the icon",
      filename: "a.tsx",
      code: lucide + 'const A = () => <ChevronRight className="h-4 w-4 rtl:rotate-180" />;',
    },
    {
      name: "rtl:-scale-x-100",
      filename: "a.tsx",
      code: lucide + 'const A = () => <ArrowLeft className="rtl:-scale-x-100" />;',
    },
    {
      name: "chosen by direction",
      filename: "a.tsx",
      code: lucide + "const A = ({ isRtl }) => (isRtl ? <ArrowLeft /> : <ChevronRight />);",
    },
    {
      name: "dir comparison in && chain",
      filename: "a.tsx",
      code: lucide + 'const A = ({ dir }) => <>{dir === "ltr" && <ChevronRight />}</>;',
    },
    {
      name: "diagonal arrow (external link) is not mirrored",
      filename: "a.tsx",
      code: lucide + "const A = () => <ArrowUpRight />;",
    },
    {
      name: "bidirectional swap icon",
      filename: "a.tsx",
      code: lucide + "const A = () => <ArrowLeftRight />;",
    },
    {
      name: "vertical chevron",
      filename: "a.tsx",
      code: lucide + "const A = () => <ChevronDown />;",
    },
    {
      name: "computed className may contain a flip",
      filename: "a.tsx",
      code: lucide + "const A = ({ c }) => <ChevronRight className={c} />;",
    },
    {
      name: "spread props may contain a flip",
      filename: "a.tsx",
      code: lucide + "const A = (p) => <ChevronRight {...p} />;",
    },
    {
      name: "flip prop",
      filename: "a.tsx",
      code: 'import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";\nconst A = () => <FontAwesomeIcon icon={faArrowRight} flip="horizontal" />;',
    },
    {
      name: "transform style",
      filename: "a.tsx",
      code: lucide + "const A = () => <ChevronRight style={{ transform: 'scaleX(-1)' }} />;",
    },
    {
      name: "parent flips its svg children",
      filename: "a.tsx",
      code:
        lucide +
        'const A = () => <span className="rtl:[&>svg]:-scale-x-100"><ChevronRight /></span>;',
    },
    {
      name: "direction-aware wrapper component",
      filename: "a.tsx",
      code: lucide + "const A = () => <DirectionalIcon><ChevronRight /></DirectionalIcon>;",
    },
    {
      name: "local component with an icon-like name (unknown source)",
      filename: "a.tsx",
      code: 'import { ChevronRight } from "./icons";\nconst A = () => <ChevronRight />;',
    },
    {
      name: "icon font with flip class",
      filename: "a.html",
      code: '<i class="fa fa-arrow-right rtl-flip"></i>',
    },
    { name: "icon font vertical", filename: "a.html", code: '<i class="fa fa-chevron-down"></i>' },
    {
      name: "ignore option",
      filename: "a.tsx",
      code: lucide + "const A = () => <ChevronRight />;",
      options: { ignore: ["ChevronRight"] },
    },
    {
      name: "string id vertical",
      filename: "a.tsx",
      code: 'import { Icon } from "@iconify/react";\nconst A = () => <Icon icon="mdi:arrow-up" />;',
    },
  ],
  invalid: [
    {
      name: "lucide chevron",
      filename: "a.tsx",
      code: lucide + "const A = () => <ChevronRight />;",
      errors: ['"ChevronRight" points the same way'],
    },
    {
      name: "static className without flip",
      filename: "a.tsx",
      code: lucide + 'const A = () => <ArrowLeft className="h-4 w-4" />;',
      errors: 1,
    },
    {
      name: "suggestion with Tailwind",
      filename: "a.tsx",
      code: lucide + 'const A = () => <ArrowLeft className="h-4" />;',
      project: TAILWIND,
      errors: ['add "rtl:-scale-x-100"'],
      suggestion: " rtl:-scale-x-100",
    },
    {
      name: "aliased import",
      filename: "a.tsx",
      code: 'import { ChevronRight as Next } from "lucide-react";\nconst A = () => <Next />;',
      errors: 1,
    },
    {
      name: "heroicons",
      filename: "a.tsx",
      code: 'import { ArrowRightIcon } from "@heroicons/react/24/outline";\nconst A = () => <ArrowRightIcon className="size-5" />;',
      errors: 1,
    },
    {
      name: "react-icons",
      filename: "a.jsx",
      code: 'import { FaChevronLeft } from "react-icons/fa";\nconst A = () => <FaChevronLeft />;',
      errors: 1,
    },
    {
      name: "MUI",
      filename: "a.tsx",
      code: 'import ArrowBackIcon from "@mui/icons-material/ArrowBack";\nconst A = () => <ArrowBackIcon />;',
      errors: 1,
    },
    {
      name: "MUI NavigateNext",
      filename: "a.tsx",
      code: 'import { NavigateNext } from "@mui/icons-material";\nconst A = () => <NavigateNext fontSize="small" />;',
      errors: 1,
    },
    {
      name: "tabler",
      filename: "a.tsx",
      code: 'import { IconChevronLeft } from "@tabler/icons-react";\nconst A = () => <IconChevronLeft size={16} />;',
      errors: 1,
    },
    {
      name: "ant design bare Right",
      filename: "a.tsx",
      code: 'import { RightOutlined } from "@ant-design/icons";\nconst A = () => <RightOutlined />;',
      errors: 1,
    },
    {
      name: "namespace import",
      filename: "a.tsx",
      code: 'import * as Icons from "lucide-react";\nconst A = () => <Icons.ChevronLeft />;',
      errors: 1,
    },
    {
      name: "FontAwesome icon prop",
      filename: "a.tsx",
      code: 'import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";\nconst A = () => <FontAwesomeIcon icon={faArrowRight} />;',
      errors: 1,
    },
    {
      name: "iconify string id",
      filename: "a.tsx",
      code: 'import { Icon } from "@iconify/react";\nconst A = () => <Icon icon="mdi:chevron-right" />;',
      errors: 1,
    },
    {
      name: "Font Awesome class in HTML",
      filename: "a.html",
      code: '<a href="/next">Next <i class="fa-solid fa-arrow-right"></i></a>',
      errors: ['Icon class "fa-arrow-right"'],
    },
    {
      name: "Bootstrap Icons class in JSX",
      filename: "a.jsx",
      code: 'const A = () => <i className="bi bi-chevron-left" />;',
      errors: 1,
    },
    {
      name: "custom icon source via options",
      filename: "a.tsx",
      code: 'import { ChevronRight } from "@/components/icons";\nconst A = () => <ChevronRight />;',
      options: { iconSources: ["@/components/icons"] },
      errors: 1,
    },
    {
      name: "unrelated ternary does not hide it",
      filename: "a.tsx",
      code: lucide + "const A = ({ open }) => (open ? <ChevronRight /> : null);",
      errors: 1,
    },
  ],
});
