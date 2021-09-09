# version 1.1.0
# docker pull doctorray/minecraft-ecsfargate-watchdog

FROM amazon/aws-cli

RUN yum install -y net-tools jq && \
    yum clean all

COPY ./watchdog.sh .

ENTRYPOINT ["./watchdog.sh"]
