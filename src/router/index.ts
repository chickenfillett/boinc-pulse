import { createRouter, createWebHistory } from "vue-router";
import OverviewView from "../views/OverviewView.vue";
import ConnectView from "../views/ConnectView.vue";
import TasksView from "../views/TasksView.vue";
import ProjectsView from "../views/ProjectsView.vue";
import TransfersView from "../views/TransfersView.vue";
import StatisticsView from "../views/StatisticsView.vue";
import MessagesView from "../views/MessagesView.vue";
import NoticesView from "../views/NoticesView.vue";
import DiskUsageView from "../views/DiskUsageView.vue";
import HostInfoView from "../views/HostInfoView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The dashboard is the landing screen: one glance, zero clicks.
    { path: "/", component: OverviewView },
    { path: "/connect", component: ConnectView },
    { path: "/tasks", component: TasksView },
    { path: "/projects", component: ProjectsView },
    { path: "/transfers", component: TransfersView },
    { path: "/statistics", component: StatisticsView },
    { path: "/event-log", component: MessagesView },
    { path: "/notices", component: NoticesView },
    { path: "/disk", component: DiskUsageView },
    { path: "/host", component: HostInfoView },
  ],
});

export default router;
